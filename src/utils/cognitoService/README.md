# 🔐 Authentication Service

A comprehensive, production-ready authentication service built with NestJS and AWS Cognito, providing secure user management, MFA support, and complete authentication workflows.

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Authentication Flows](#authentication-flows)
- [Security Best Practices](#security-best-practices)
- [Monitoring & Observability](#monitoring--observability)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

---

## ✨ Features

### Core Authentication
- ✅ User registration with email verification
- ✅ Secure login with JWT tokens
- ✅ Multi-factor authentication (TOTP)
- ✅ Token refresh mechanism
- ✅ Secure logout (global sign-out)
- ✅ Password reset flows

### User Management
- ✅ Admin user creation
- ✅ User profile management
- ✅ Account enable/disable
- ✅ User listing with pagination
- ✅ Attribute updates
- ✅ User deletion

### Security Features
- ✅ AWS Cognito integration
- ✅ MFA with QR code generation
- ✅ Temporary password support
- ✅ Admin confirmation bypass
- ✅ Comprehensive logging

### Monitoring
- ✅ Health check endpoint
- ✅ Service metrics
- ✅ Request logging

---

## 🏗️ Architecture

```
┌─────────────────┐
│   API Gateway   │
│   (NestJS)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Auth Service   │◄──── Business Logic Layer
│  (This Service) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cognito Service │◄──── AWS SDK Wrapper
│ (alchemy-utils) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AWS Cognito    │◄──── Identity Provider
│   User Pool     │
└─────────────────┘
```

### Service Layers

1. **Controller Layer**: HTTP request handling, validation, routing
2. **Service Layer** (This file): Business logic, transformation, coordination
3. **Integration Layer**: AWS Cognito SDK wrapper
4. **AWS Cognito**: Identity and access management

---

## 📦 Prerequisites

### Required
- Node.js >= 18.x
- NestJS >= 10.x
- AWS Account with Cognito User Pool
- `alchemy-utilities` package with CognitoService

### AWS Cognito Setup
1. Create a User Pool in AWS Cognito
2. Configure app client (no client secret)
3. Enable required attributes (email)
4. Configure password policies
5. Set up email/SMS verification

---

## 🚀 Installation

```bash
# Install dependencies
npm install

# Install peer dependencies
npm install @nestjs/common @nestjs/core
npm install alchemy-utilities
```

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# ============================================================================
# AWS COGNITO CONFIGURATION (REQUIRED)
# ============================================================================
# AWS Region where your Cognito User Pool is located
AWS_REGION=us-east-1

# Your Cognito User Pool ID (found in AWS Console > Cognito > User Pools)
# Format: <region>_<alphanumeric>
COGNITO_USER_POOL_ID=us-east-1_AbCd12345

# Your Cognito App Client ID (found in User Pool > App Integration > App Clients)
# This should be a client WITHOUT client secret for security
COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m

# ============================================================================
# AWS CREDENTIALS (OPTIONAL - Use IAM Roles in production)
# ============================================================================
# Only needed if NOT using IAM roles (EC2, ECS, Lambda, etc.)
# DO NOT commit these to version control - use AWS Secrets Manager/Parameter Store
# AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
# AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# ============================================================================
# APPLICATION CONFIGURATION (REQUIRED)
# ============================================================================
# Application name (used in MFA QR codes and email templates)
APP_NAME=MyApp

# MFA Issuer name (appears in authenticator apps like Google Authenticator)
MFA_ISSUER=MyApp

# Server port
PORT=3000

# Node environment
NODE_ENV=production

# ============================================================================
# JWT TOKEN CONFIGURATION (Managed by Cognito)
# ============================================================================
# Note: JWT tokens are automatically managed by AWS Cognito
# Token lifetimes are configured in AWS Cognito User Pool settings:
# - Access Token expiration (default: 1 hour, range: 5 mins - 24 hours)
# - ID Token expiration (default: 1 hour, range: 5 mins - 24 hours)  
# - Refresh Token expiration (default: 30 days, range: 1 hour - 10 years)

# To configure JWT tokens:
# AWS Console > Cognito > User Pools > Your Pool > App Integration > 
# App Clients > Edit > Token expiration settings

# ============================================================================
# CORS CONFIGURATION (REQUIRED for web clients)
# ============================================================================
# Comma-separated list of allowed origins
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com,http://localhost:3000

# Allow credentials (cookies, authorization headers)
CORS_CREDENTIALS=true

# ============================================================================
# RATE LIMITING (RECOMMENDED for production)
# ============================================================================
# Time window in seconds
RATE_LIMIT_TTL=60

# Maximum requests per time window
RATE_LIMIT_MAX=100

# Auth endpoints stricter limits
AUTH_RATE_LIMIT_TTL=60
AUTH_RATE_LIMIT_MAX=10

# ============================================================================
# LOGGING CONFIGURATION (OPTIONAL)
# ============================================================================
# Log level: debug, info, warn, error
LOG_LEVEL=info

# Enable request logging
ENABLE_REQUEST_LOGGING=true

# ============================================================================
# MONITORING & OBSERVABILITY (OPTIONAL)
# ============================================================================
# Application Performance Monitoring
# APM_SERVICE_NAME=auth-service
# APM_SERVER_URL=https://apm.yourdomain.com
# APM_SECRET_TOKEN=your-apm-token

# Sentry Error Tracking
# SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# ============================================================================
# SECURITY HEADERS (RECOMMENDED)
# ============================================================================
# Content Security Policy
# CSP_DIRECTIVES=default-src 'self'; script-src 'self' 'unsafe-inline'

# ============================================================================
# EMAIL CONFIGURATION (If using custom email templates)
# ============================================================================
# These are managed in Cognito, but you can reference them here
# SUPPORT_EMAIL=support@yourdomain.com
# NO_REPLY_EMAIL=noreply@yourdomain.com
```

### AWS Cognito JWT Token Configuration

JWT tokens in this service are **automatically managed by AWS Cognito**. You don't need to configure JWT secrets or signing keys manually.

#### Token Types

1. **Access Token** (`accessToken`)
   - Used for API authentication
   - Contains user permissions and groups
   - Short-lived (default: 1 hour)
   - Used in `Authorization: Bearer <token>` header

2. **ID Token** (`idToken`)
   - Contains user identity information
   - Includes custom attributes
   - Short-lived (default: 1 hour)
   - Used for user profile data

3. **Refresh Token** (`refreshToken`)
   - Used to obtain new access/ID tokens
   - Long-lived (default: 30 days)
   - Should be stored securely (httpOnly cookies recommended)
   - Cannot be revoked individually (only via global sign-out)

#### Configure Token Lifetimes in AWS Cognito

**Via AWS Console:**
```
1. Go to AWS Cognito Console
2. Select your User Pool
3. Go to "App Integration" → "App clients and analytics"
4. Click on your app client
5. Click "Edit" under "Hosted UI settings"
6. Scroll to "Token expiration settings":
   - Access token expiration: 1 hour (3600 seconds) [Range: 5m - 24h]
   - ID token expiration: 1 hour (3600 seconds) [Range: 5m - 24h]
   - Refresh token expiration: 30 days [Range: 1h - 10 years]
7. Save changes
```

**Via AWS CLI:**
```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id us-east-1_AbCd12345 \
  --client-id 1a2b3c4d5e6f7g8h9i0j1k2l3m \
  --access-token-validity 60 \
  --id-token-validity 60 \
  --refresh-token-validity 30 \
  --token-validity-units AccessToken=minutes,IdToken=minutes,RefreshToken=days
```

**Via Terraform:**
```hcl
resource "aws_cognito_user_pool_client" "client" {
  name         = "my-app-client"
  user_pool_id = aws_cognito_user_pool.pool.id

  access_token_validity  = 60  # minutes
  id_token_validity      = 60  # minutes
  refresh_token_validity = 30  # days

  token_validity_units {
    access_token  = "minutes"
    id_token      = "minutes"
    refresh_token = "days"
  }
}
```

#### JWT Token Structure

**Access Token Payload Example:**
```json
{
  "sub": "user-uuid",
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCd12345",
  "client_id": "1a2b3c4d5e6f7g8h9i0j1k2l3m",
  "origin_jti": "xxx",
  "event_id": "xxx",
  "token_use": "access",
  "scope": "aws.cognito.signin.user.admin",
  "auth_time": 1699353600,
  "exp": 1699357200,
  "iat": 1699353600,
  "jti": "xxx",
  "username": "user@example.com"
}
```

**ID Token Payload Example:**
```json
{
  "sub": "user-uuid",
  "email_verified": true,
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_AbCd12345",
  "cognito:username": "user@example.com",
  "origin_jti": "xxx",
  "aud": "1a2b3c4d5e6f7g8h9i0j1k2l3m",
  "event_id": "xxx",
  "token_use": "id",
  "auth_time": 1699353600,
  "exp": 1699357200,
  "iat": 1699353600,
  "email": "user@example.com",
  "name": "John Doe"
}
```

### Module Configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AuthModule,
  ],
})
export class AppModule {}
```

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { CognitoModule } from 'alchemy-utilities';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    CognitoModule.forRoot({
      region: process.env.AWS_REGION,
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

---

## 📚 API Documentation

### Base URL
```
https://api.yourdomain.com/auth
```

### Authentication
Most admin endpoints require an access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

---

## 🔄 Authentication Flows

### 1. User Registration Flow

```mermaid
sequenceDiagram
    participant U as User
    participant API as Auth API
    participant C as Cognito
    participant E as Email

    U->>API: POST /auth/signup
    API->>C: Create User
    C->>E: Send Verification Code
    C-->>API: User Created
    API-->>U: Success + Instructions
    
    E->>U: Verification Code
    U->>API: POST /auth/confirm-signup
    API->>C: Confirm Sign Up
    C-->>API: Confirmed
    API-->>U: Email Verified
```

**Step 1: Sign Up**
```bash
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "attributes": {
    "name": "John Doe",
    "phone_number": "+1234567890"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully. Please check your email for verification code.",
  "data": {
    "userId": "user-uuid",
    "emailVerified": false,
    "codeDeliveryDestination": "u***@example.com"
  }
}
```

**Step 2: Confirm Email**
```bash
POST /auth/confirm-signup
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456"
}
```

---

### 2. Login Flow

**Standard Login:**
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGc...",
    "idToken": "eyJhbGc...",
    "refreshToken": "eyJjdHk...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

**MFA Required Response:**
```json
{
  "success": true,
  "requiresMFA": true,
  "message": "MFA code required",
  "data": {
    "challenge": "SMS_MFA",
    "session": "session-token"
  }
}
```

---

### 3. MFA Setup Flow

**Step 1: Initiate MFA Setup**
```bash
POST /auth/mfa/setup
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "accessToken": "eyJhbGc..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "MFA setup initiated. Scan QR code with your authenticator app.",
  "data": {
    "secretCode": "JBSWY3DPEHPK3PXP",
    "qrCodeUrl": "otpauth://totp/MyApp:User?secret=JBSWY3DPEHPK3PXP&issuer=MyApp",
    "session": "session-token"
  }
}
```

**Step 2: Confirm MFA**
```bash
POST /auth/mfa/confirm
Content-Type: application/json

{
  "accessToken": "eyJhbGc...",
  "code": "123456",
  "deviceName": "iPhone 13"
}
```

---

### 4. Password Reset Flow

**Step 1: Request Reset Code**
```bash
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Step 2: Reset Password**
```bash
POST /auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!"
}
```

---

### 5. Token Refresh Flow

```bash
POST /auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "eyJjdHk..."
}
```

---

### 6. Admin Operations

**Create User:**
```bash
POST /auth/admin/users
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "email": "newuser@example.com",
  "temporaryPassword": "TempPass123!",
  "emailVerified": true,
  "attributes": {
    "name": "Jane Doe"
  }
}
```

**List Users:**
```bash
GET /auth/admin/users/list?limit=20&filter=email^="john"
Authorization: Bearer <admin_access_token>
```

**Get User:**
```bash
POST /auth/admin/users/get
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Update User Attributes:**
```bash
PUT /auth/admin/users/attributes
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "email": "user@example.com",
  "attributes": {
    "name": "Updated Name",
    "phone_number": "+1234567890"
  }
}
```

**Disable/Enable User:**
```bash
POST /auth/admin/users/disable
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Delete User:**
```bash
DELETE /auth/admin/users
Authorization: Bearer <admin_access_token>
Content-Type: application/json

{
  "email": "user@example.com"
}
```

---

## 🔒 Security Best Practices

### Implemented

1. **Password Policies** (Configured in Cognito):
   - Minimum length: 8 characters
   - Requires uppercase, lowercase, numbers, special characters
   - Password history: 24 previous passwords

2. **Token Security**:
   - JWT tokens with expiration
   - Refresh token rotation
   - Global sign-out invalidates all tokens

3. **MFA Support**:
   - TOTP-based MFA
   - QR code generation for easy setup
   - Device trust management

4. **Email Verification**:
   - Required for account activation
   - Admin bypass option available

### Recommended Enhancements

```typescript
// Add rate limiting
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10, // 10 requests per minute
    }),
  ],
})

// Add helmet for security headers
import helmet from 'helmet';
app.use(helmet());

// Add CORS
app.enableCors({
  origin: process.env.CORS_ORIGINS?.split(','),
  credentials: true,
});
```

---

## 📊 Monitoring & Observability

### Health Check

```bash
GET /auth/health
```

**Response:**
```json
{
  "success": true,
  "message": "Service is healthy",
  "data": {
    "status": "healthy",
    "cognito": "connected",
    "timestamp": "2025-11-07T10:30:00Z"
  }
}
```

### Metrics

```bash
GET /auth/metrics
```

**Response:**
```json
{
  "success": true,
  "message": "Metrics retrieved",
  "data": {
    "totalRequests": 15234,
    "successfulLogins": 1234,
    "failedLogins": 45,
    "mfaSetups": 234,
    "passwordResets": 67,
    "uptime": 86400
  }
}
```

### Logging

The service logs all operations with appropriate log levels:
- `LOG`: Successful operations
- `WARN`: Suspicious activities
- `ERROR`: Failed operations (via CognitoService)

**Log Format:**
```
[AuthService] Sign up attempt for: user@example.com
[AuthService] Login attempt for: user@example.com
[AuthService] Admin creating user: newuser@example.com
```

---

## ⚠️ Error Handling

### Standard Error Response

```json
{
  "statusCode": 400,
  "message": "Error message here",
  "error": "Bad Request"
}
```

### Common Error Codes

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `InvalidParameterException` | Invalid input data |
| 401 | `NotAuthorizedException` | Invalid credentials |
| 403 | `UserNotFoundException` | User doesn't exist |
| 409 | `UsernameExistsException` | Email already registered |
| 429 | `TooManyRequestsException` | Rate limit exceeded |
| 500 | `InternalErrorException` | Server error |

### Error Handling Best Practices

Add try-catch blocks in production:

```typescript
async signUp(dto: SignUpDto) {
  try {
    this.logger.log(`Sign up attempt for: ${dto.email}`);
    
    const result = await this.cognitoService.signUp(
      dto.email,
      dto.password,
      dto.attributes,
    );

    return {
      success: true,
      message: 'User registered successfully.',
      data: { /* ... */ },
    };
  } catch (error) {
    this.logger.error(`Sign up failed for ${dto.email}:`, error.message);
    
    // Transform Cognito errors to user-friendly messages
    if (error.name === 'UsernameExistsException') {
      throw new ConflictException('Email already registered');
    }
    
    throw new BadRequestException(error.message);
  }
}
```

---

## 🧪 Testing

### Unit Tests

```typescript
// auth.service.spec.ts
describe('AuthService', () => {
  let service: AuthService;
  let cognitoService: CognitoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: CognitoService,
          useValue: {
            signUp: jest.fn(),
            login: jest.fn(),
            // ... other mocks
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    cognitoService = module.get<CognitoService>(CognitoService);
  });

  it('should register a new user', async () => {
    const dto: SignUpDto = {
      email: 'test@example.com',
      password: 'Test123!',
    };

    jest.spyOn(cognitoService, 'signUp').mockResolvedValue({
      userId: 'user-123',
      confirmed: false,
    });

    const result = await service.signUp(dto);

    expect(result.success).toBe(true);
    expect(cognitoService.signUp).toHaveBeenCalledWith(
      dto.email,
      dto.password,
      undefined,
    );
  });
});
```

### Integration Tests

```typescript
// auth.e2e-spec.ts
describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/auth/signup (POST)', () => {
    return request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        email: 'test@example.com',
        password: 'Test123!',
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.success).toBe(true);
      });
  });
});
```

### Run Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

---

## 🔧 Troubleshooting

### Common Issues

**1. "User pool not found"**
```bash
# Verify Cognito configuration
aws cognito-idp describe-user-pool --user-pool-id <pool-id>

# Check environment variables
echo $COGNITO_USER_POOL_ID
echo $COGNITO_CLIENT_ID
```

**2. "Invalid password format"**
- Check Cognito password policy in AWS Console
- Ensure password meets minimum requirements
- Verify special characters are allowed

**3. "Code mismatch"**
- Verification codes expire after 24 hours
- Check email spam folder
- Request new code via forgot-password flow

**4. "Token expired"**
- Access tokens expire after 1 hour (configurable)
- Use refresh token to get new access token
- Implement token refresh logic in frontend

**5. "Rate limit exceeded"**
- Implement exponential backoff
- Add rate limiting middleware
- Consider using Redis for distributed rate limiting

### Debug Mode

Enable detailed logging:
```bash
# .env
LOG_LEVEL=debug
NODE_ENV=development
```

---

## 📖 Additional Resources

### AWS Cognito Documentation
- [User Pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-identity-pools.html)
- [MFA Setup](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html)
- [Token Management](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html)

### NestJS Documentation
- [Authentication](https://docs.nestjs.com/security/authentication)
- [Guards](https://docs.nestjs.com/guards)
- [Exception Filters](https://docs.nestjs.com/exception-filters)

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## 🔄 Changelog

### Version 0.0.13 (Current)
- ✅ Complete authentication flows
- ✅ MFA support with TOTP
- ✅ Admin user management
- ✅ Health checks and metrics
- ✅ Comprehensive logging

### Planned Features
- [ ] Social login (Google, Facebook)
- [ ] Biometric authentication
- [ ] Advanced audit logging
- [ ] Rate limiting per user
- [ ] IP-based access control
- [ ] Session management dashboard

---

**Built with ❤️ using NestJS and AWS Cognito**