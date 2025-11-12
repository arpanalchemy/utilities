# AWS Cognito Service - Production Ready

A production-ready, feature-rich AWS Cognito authentication service for NestJS applications with built-in security, and monitoring.

## 📦 Installation

```bash
npm install alchemy-utilities
```

## 🚀 Features

- ✅ **Complete Authentication Flow** - Signup, login, MFA, password reset
- 🔐 **JWT Token Management** - Validation, verification, and refresh
- 🛡️ **Security Features**
  - Token blacklisting and revocation
  - Input validation and sanitization
- 📊 **Monitoring** - Built-in metrics and health checks
- ⚡ **Performance**
  - Configuration caching
  - Secret hash caching
  - Connection pooling
  - Request timeouts & retries
- 🔒 **Privacy** - Sanitized logging (emails masked)
- 🧹 **Memory Safe** - Automatic cleanup and leak prevention

---

## 📋 Table of Contents

- [Environment Variables](#environment-variables)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Authentication Methods](#authentication-methods)
- [JWT Token Management](#jwt-token-management)
- [User Management](#user-management)
- [MFA Setup](#mfa-setup)
- [Error Handling](#error-handling)
- [Monitoring](#monitoring)
- [API Reference](#api-reference)

---

## 🔧 Environment Variables

### Required

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
AWS_COGNITO_CLIENT_ID=your-client-id

# Optional: Required if using client secret
AWS_COGNITO_CLIENT_SECRET=your-client-secret
```

### Optional

```env
# Logging
LOG_LEVEL=debug  # Enable detailed operation logging
NODE_ENV=production  # Hide stack traces in production
```

### Using AWS Systems Manager (SSM)

If you have `SecretsService` configured, the service will automatically fetch credentials from SSM Parameter Store:

```
/cognito/user_pool_id
/cognito/client_id
/cognito/client_secret
```

**IAM Permissions Required:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter",
        "ssm:GetParameters"
      ],
      "Resource": "arn:aws:ssm:REGION:ACCOUNT:parameter/cognito/*"
    }
  ]
}
```

---

## 🚀 Quick Start

### 1. Module Setup

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { CognitoService } from 'alchemy-utilities';

@Module({
  providers: [CognitoService],
  exports: [CognitoService],
})
export class AuthModule {}
```

### 2. Basic Usage

```typescript
// auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { CognitoService } from 'alchemy-utilities';

@Controller('auth')
export class AuthController {
  constructor(private readonly cognito: CognitoService) {}

  @Post('signup')
  async signup(@Body() body: { email: string; password: string }) {
    return this.cognito.signUp(body.email, body.password);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.cognito.login(body.email, body.password);
  }
}
```

---

## 🔐 Authentication Methods

### Sign Up

```typescript
// Basic signup
const result = await cognito.signUp('user@example.com', 'SecurePass123!');

// Signup with attributes
const result = await cognito.signUp(
  'user@example.com',
  'SecurePass123!',
  {
    name: 'John Doe',
    phone_number: '+1234567890',
    birthdate: '1990-01-01'
  }
);

// Response
{
  userId: 'user-uuid',
  confirmed: false,
  codeDelivery: {
    destination: 'u***@example.com',
    deliveryMedium: 'EMAIL'
  }
}
```

### Confirm Sign Up

```typescript
await cognito.confirmSignUp('user@example.com', '123456');
// Returns: { success: true, message: 'User confirmed successfully' }
```

### Login

```typescript
const result = await cognito.login('user@example.com', 'SecurePass123!');

// Success Response
{
  accessToken: 'eyJraWQiOiI...',
  idToken: 'eyJraWQiOiI...',
  refreshToken: 'eyJjdHkiOiI...',
  expiresIn: 3600,
  tokenType: 'Bearer'
}

// MFA Challenge Response
{
  requiresMFA: true,
  challenge: 'SOFTWARE_TOKEN_MFA',
  session: 'session-token'
}

// New Password Required
{
  requiresNewPassword: true,
  session: 'session-token'
}
```

### Verify MFA

```typescript
const result = await cognito.verifyMFA(
  'user@example.com',
  'session-token',
  '123456',
  ChallengeNameType.SOFTWARE_TOKEN_MFA
);
// Returns JWT tokens
```

### Refresh Token

```typescript
const result = await cognito.refreshToken('refresh-token-here');
// Returns new accessToken and idToken
```

### Logout

```typescript
await cognito.globalSignOut('access-token');
// Returns: { success: true, message: 'Signed out successfully' }
```

---

## 🎫 JWT Token Management

### Verify Token (Full Validation)

```typescript
try {
  const payload = await cognito.verifyToken(accessToken);
  
  console.log(payload.sub);              // User ID
  console.log(payload.email);            // Email
  console.log(payload['cognito:username']); // Username
  console.log(payload['cognito:groups']);   // User groups
} catch (error) {
  // Token invalid, expired, or revoked
}
```

### Decode Token (No Verification)

```typescript
const payload = cognito.decodeToken(accessToken);
// Use for non-critical operations only
```

### Check Token Expiration

```typescript
const isExpired = cognito.isTokenExpired(accessToken);
if (isExpired) {
  // Refresh the token
}
```

### Token Payload Interface

```typescript
interface TokenPayload {
  sub: string;                    // User ID
  email?: string;                 // User email
  email_verified?: boolean;       // Email verification status
  'cognito:username'?: string;    // Username
  'cognito:groups'?: string[];    // User groups
  exp: number;                    // Expiration timestamp
  iat: number;                    // Issued at timestamp
}
```

---

## 👤 User Management

### Get User Details

```typescript
const user = await cognito.getUser('user@example.com');

// Response
{
  username: 'user@example.com',
  status: 'CONFIRMED',
  enabled: true,
  created: Date,
  modified: Date,
  attributes: {
    email: 'user@example.com',
    email_verified: 'true',
    name: 'John Doe'
  }
}
```

### Get Current User (from token)

```typescript
const user = await cognito.getCurrentUser(accessToken);

// Response
{
  username: 'user@example.com',
  attributes: {
    email: 'user@example.com',
    name: 'John Doe'
  }
}
```

### Update User Attributes

```typescript
await cognito.updateUserAttributes('user@example.com', {
  name: 'Jane Doe',
  phone_number: '+1234567890'
});
```

### List Users

```typescript
const result = await cognito.listUsers(20, paginationToken);

// Response
{
  users: [
    {
      username: 'user@example.com',
      status: 'CONFIRMED',
      enabled: true,
      created: Date,
      modified: Date,
      attributes: { ... }
    }
  ],
  nextToken: 'pagination-token'
}

// With filter
await cognito.listUsers(20, undefined, 'email ^= "admin"');
```

### Admin Operations

```typescript
// Create user with temporary password
await cognito.adminCreateUser(
  'user@example.com',
  'TempPass123!',
  true, // email verified
  { name: 'Admin User' }
);

// Confirm user (skip email verification)
await cognito.adminConfirmSignUp('user@example.com');

// Set permanent password
await cognito.setPassword('user@example.com', 'NewPass123!', true);

// Disable user
await cognito.disableUser('user@example.com');

// Enable user
await cognito.enableUser('user@example.com');

// Delete user
await cognito.deleteUser('user@example.com');
```

---

## 🔒 MFA Setup

### Setup MFA (Get QR Code Secret)

```typescript
const result = await cognito.setupMFA(accessToken);

// Response
{
  secretCode: 'JBSWY3DPEHPK3PXP',
  session: 'session-token'
}

// Generate QR Code URL (use with qrcode library)
const qrCodeUrl = `otpauth://totp/YourApp:${email}?secret=${secretCode}&issuer=YourApp`;
```

### Confirm MFA Setup

```typescript
await cognito.confirmMFA(
  accessToken,
  '123456', // TOTP code from authenticator app
  'My iPhone' // device name
);

// Response
{
  status: 'SUCCESS',
  message: 'MFA enabled successfully'
}
```

---

## 🔑 Password Management

### Forgot Password

```typescript
const result = await cognito.forgotPassword('user@example.com');

// Response
{
  codeDelivery: {
    destination: 'u***@example.com',
    deliveryMedium: 'EMAIL'
  },
  message: 'Password reset code sent'
}
```

### Confirm Forgot Password

```typescript
await cognito.confirmForgotPassword(
  'user@example.com',
  '123456',
  'NewSecurePass123!'
);

// Returns: { success: true, message: 'Password reset successfully' }
```

---


## 🚨 Error Handling

### Error Response Format

```typescript
{
  statusCode: 400,
  message: 'Invalid verification code provided',
  error: 'Bad Request',
  timestamp: '2024-01-01T12:00:00.000Z'
}
```

### Common Errors

| Error | Status | Message |
|-------|--------|---------|
| `CodeMismatchException` | 400 | Invalid verification code provided |
| `ExpiredCodeException` | 400 | Verification code has expired |
| `UserNotFoundException` | 404 | User not found |
| `NotAuthorizedException` | 401 | Invalid credentials or unauthorized access |
| `UsernameExistsException` | 409 | User already exists |
| `InvalidPasswordException` | 400 | Password does not meet security requirements |
| `UserNotConfirmedException` | 403 | Please verify your email before logging in |
| `TooManyRequestsException` | 429 | Too many requests, please try again later |

### Error Handling Example

```typescript
try {
  await cognito.login(email, password);
} catch (error) {
  if (error.status === 401) {
    // Invalid credentials
  } else if (error.status === 403) {
    // Account locked or not confirmed
  }
}
```

---

## 📊 Monitoring

### Get Service Metrics

```typescript
const metrics = cognito.getMetrics();

// Response
{
  totalRequests: 1234,
  totalErrors: 12,
  errorRate: '0.97%',
  errorsByType: {
    'NotAuthorizedException': 8,
    'UserNotFoundException': 4
  },
  lastError: {
    type: 'NotAuthorizedException',
    time: Date
  },
  averageRequestTime: '234.56ms',
  cache: {
    configCached: true,
    secretHashCacheSize: 45,
    tokenBlacklistSize: 3
  },
  client: {
    initialized: true
  },
  security: {
    lockedAccounts: 2,
    revokedTokens: 3
  }
}
```

### Health Check

```typescript
const health = await cognito.healthCheck();

// Response
{
  status: 'healthy',
  service: 'CognitoService',
  timestamp: '2024-01-01T12:00:00.000Z',
  config: {
    userPoolId: 'us-east-1_***',
    region: 'us-east-1'
  }
}
```

### Clear Caches

```typescript
cognito.clearCaches();
```

### Reset Metrics

```typescript
cognito.resetMetrics();
```

---

## 🔐 Authentication Guard Example

```typescript
// jwt-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { CognitoService } from 'alchemy-utilities';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private cognito: CognitoService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      return false;
    }

    try {
      const payload = await this.cognito.verifyToken(token);
      request.user = payload;
      return true;
    } catch {
      return false;
    }
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }
}
```

### Usage

```typescript
@Controller('protected')
@UseGuards(JwtAuthGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(@Request() req) {
    return {
      userId: req.user.sub,
      email: req.user.email,
      groups: req.user['cognito:groups']
    };
  }
}
```

---

## 🎯 Best Practices

### 1. Token Management

```typescript
// Store tokens securely (httpOnly cookies recommended)
response.cookie('accessToken', tokens.accessToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 3600000 // 1 hour
});

// Always verify tokens on protected routes
const payload = await cognito.verifyToken(accessToken);

// Refresh tokens before expiration
if (cognito.isTokenExpired(accessToken)) {
  const newTokens = await cognito.refreshToken(refreshToken);
}
```

### 2. Error Handling

```typescript
// Always handle specific error cases
try {
  await cognito.login(email, password);
} catch (error) {
  switch (error.status) {
    case 401:
      return 'Invalid credentials';
    case 403:
      return 'Please verify your email';
    case 429:
      return 'Too many attempts, try again later';
    default:
      return 'An error occurred';
  }
}
```


### 4. Logging

```typescript
// Enable debug logging in development
// LOG_LEVEL=debug

// Disable in production for security
// NODE_ENV=production
```

---

## 📝 TypeScript Interfaces

```typescript
// Enums
enum ChallengeNameType {
  SOFTWARE_TOKEN_MFA = 'SOFTWARE_TOKEN_MFA',
  SMS_MFA = 'SMS_MFA',
  NEW_PASSWORD_REQUIRED = 'NEW_PASSWORD_REQUIRED',
}

enum UserStatus {
  UNCONFIRMED = 'UNCONFIRMED',
  CONFIRMED = 'CONFIRMED',
  ARCHIVED = 'ARCHIVED',
  COMPROMISED = 'COMPROMISED',
  UNKNOWN = 'UNKNOWN',
  RESET_REQUIRED = 'RESET_REQUIRED',
  FORCE_CHANGE_PASSWORD = 'FORCE_CHANGE_PASSWORD',
}

// Responses
interface LoginResponse {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

interface MFAChallengeResponse {
  requiresMFA: true;
  challenge: string;
  session: string;
}

interface TokenPayload extends JwtPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  'cognito:username'?: string;
  'cognito:groups'?: string[];
}

interface UserDetails {
  username?: string;
  status?: string;
  enabled?: boolean;
  created?: Date;
  modified?: Date;
  attributes?: Record<string, string>;
}
```

---

## 🔧 Advanced Configuration

### Custom Timeouts

The service uses these defaults:
- **Connection Timeout:** 3000ms
- **Socket Timeout:** 5000ms
- **Max Retry Attempts:** 3

These are optimized for production use and cannot be changed without modifying the source.

### Cache Configuration

- **Config Cache TTL:** 5 minutes
- **Max Cache Size:** 1000 entries
- **JWKS Cache:** 10 minutes

---

## 🐛 Troubleshooting

### Access Denied Error (SSM)

```
🚫 Access denied while fetching from AWS SSM
```

**Solution:** Ensure IAM role/user has `ssm:GetParameter` permission.

### Configuration Missing

```
AWS Cognito configuration missing
```

**Solution:** Set environment variables or configure SSM parameters.

### Token Verification Failed

```
Token verification failed: invalid signature
```

**Solutions:**
- Ensure token is not expired
- Check user pool ID matches
- Verify token hasn't been revoked



## 🤝 Support

For issues and questions:
- Check the [Troubleshooting](#troubleshooting) section
- Review AWS Cognito documentation
- Check IAM permissions for SSM and Cognito

---

## 🎉 Complete Example

```typescript
import { Module, Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { CognitoService, ChallengeNameType } from 'alchemy-utilities';

// Module
@Module({
  providers: [CognitoService],
  exports: [CognitoService],
})
export class AuthModule {}

// Controller
@Controller('auth')
export class AuthController {
  constructor(private readonly cognito: CognitoService) {}

  @Post('signup')
  async signup(@Body() body: { email: string; password: string }) {
    return this.cognito.signUp(body.email, body.password);
  }

  @Post('confirm')
  async confirm(@Body() body: { email: string; code: string }) {
    return this.cognito.confirmSignUp(body.email, body.code);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const result = await this.cognito.login(body.email, body.password);
    
    if ('requiresMFA' in result) {
      return { requiresMFA: true, session: result.session };
    }
    
    return result;
  }

  @Post('verify-mfa')
  async verifyMfa(@Body() body: { email: string; session: string; code: string }) {
    return this.cognito.verifyMFA(
      body.email,
      body.session,
      body.code,
      ChallengeNameType.SOFTWARE_TOKEN_MFA
    );
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.cognito.forgotPassword(body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { email: string; code: string; newPassword: string }) {
    return this.cognito.confirmForgotPassword(body.email, body.code, body.newPassword);
  }

  @Get('metrics')
  getMetrics() {
    return this.cognito.getMetrics();
  }

  @Get('health')
  healthCheck() {
    return this.cognito.healthCheck();
  }
}
```

---

**Built with ❤️ for production use**