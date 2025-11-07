# Production-Ready AWS Cognito Service for NestJS

Complete, plug-and-play AWS Cognito authentication service with JWT token management, MFA support, and comprehensive user management.

## 🚀 Features

- ✅ **Complete Auth Flow**: Signup, login, logout, password reset
- ✅ **JWT Token Management**: Access, ID, and refresh tokens
- ✅ **MFA Support**: TOTP/Software token MFA
- ✅ **User Management**: CRUD operations, enable/disable, list users
- ✅ **Production Optimized**: Caching, connection pooling, retries
- ✅ **Clean Error Handling**: No stack traces in production
- ✅ **Privacy-Safe Logging**: Sanitized email addresses
- ✅ **Metrics & Monitoring**: Built-in health checks
- ✅ **Zero Configuration**: Works with environment variables
- ✅ **Memory Safe**: Automatic cache cleanup

## 📦 Installation

```bash
npm install @aws-sdk/client-cognito-identity-provider @smithy/node-http-handler
```

## ⚙️ Configuration

Set these environment variables:

```bash
# Required
AWS_REGION=us-east-1
AWS_COGNITO_USER_POOL_ID=us-east-1_xxxxx
AWS_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx

# Optional (for app clients with secret)
AWS_COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxx

# Optional
NODE_ENV=production
```

## 🔧 Setup

### 1. Add to Your Module

```typescript
import { Module } from '@nestjs/common';
import { CognitoService } from './cognito.service';
import { CognitoExceptionFilter } from './cognito-exception.filter';

@Module({
  providers: [CognitoService],
  exports: [CognitoService],
})
export class AuthModule {}
```

### 2. Apply Global Exception Filter

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CognitoExceptionFilter } from './cognito-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Apply Cognito exception filter globally
  app.useGlobalFilters(new CognitoExceptionFilter());
  
  await app.listen(3000);
}
bootstrap();
```

## 📖 Usage Examples

### Basic Authentication

```typescript
import { Injectable } from '@nestjs/common';
import { CognitoService } from './cognito.service';

@Injectable()
export class AuthService {
  constructor(private cognito: CognitoService) {}

  async register(email: string, password: string) {
    // Sign up user
    const result = await this.cognito.signUp(email, password);
    
    return {
      userId: result.userId,
      message: 'Verification code sent to email',
    };
  }

  async verify(email: string, code: string) {
    // Confirm email with verification code
    await this.cognito.confirmSignUp(email, code);
    
    return { message: 'Email verified successfully' };
  }

  async login(email: string, password: string) {
    // Login user
    const result = await this.cognito.login(email, password);
    
    // Check if MFA is required
    if (result.requiresMFA) {
      return {
        requiresMFA: true,
        session: result.session,
      };
    }
    
    // Return JWT tokens
    return {
      accessToken: result.accessToken,
      idToken: result.idToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  }

  async refreshTokens(refreshToken: string) {
    // Refresh access token
    const result = await this.cognito.refreshToken(refreshToken);
    
    return {
      accessToken: result.accessToken,
      idToken: result.idToken,
      expiresIn: result.expiresIn,
    };
  }

  async logout(accessToken: string) {
    // Global sign out (invalidate all tokens)
    await this.cognito.globalSignOut(accessToken);
    
    return { message: 'Logged out successfully' };
  }
}
```

### Password Reset Flow

```typescript
async forgotPassword(email: string) {
  // Initiate password reset
  const result = await this.cognito.forgotPassword(email);
  
  return {
    message: 'Reset code sent to email',
    destination: result.codeDelivery.Destination,
  };
}

async resetPassword(email: string, code: string, newPassword: string) {
  // Confirm password reset with code
  await this.cognito.confirmForgotPassword(email, code, newPassword);
  
  return { message: 'Password reset successfully' };
}
```

### MFA Setup

```typescript
async enableMFA(accessToken: string) {
  // Get MFA secret code
  const result = await this.cognito.setupMFA(accessToken);
  
  // Generate QR code URL for authenticator apps
  const qrCodeUrl = `otpauth://totp/MyApp:user@example.com?secret=${result.secretCode}&issuer=MyApp`;
  
  return {
    secretCode: result.secretCode,
    qrCodeUrl,
  };
}

async verifyMFASetup(accessToken: string, code: string) {
  // Verify TOTP code and enable MFA
  await this.cognito.confirmMFA(accessToken, code);
  
  return { message: 'MFA enabled successfully' };
}

async loginWithMFA(email: string, password: string, mfaCode: string) {
  // Step 1: Initial login
  const loginResult = await this.cognito.login(email, password);
  
  if (loginResult.requiresMFA) {
    // Step 2: Verify MFA code
    const result = await this.cognito.verifyMFA(
      email,
      loginResult.session,
      mfaCode,
    );
    
    return {
      accessToken: result.accessToken,
      idToken: result.idToken,
      refreshToken: result.refreshToken,
    };
  }
  
  return loginResult;
}
```

### User Management (Admin)

```typescript
async createUser(email: string) {
  // Create user with temporary password
  const tempPassword = this.generateTempPassword();
  
  const result = await this.cognito.adminCreateUser(
    email,
    tempPassword,
    true, // Email verified
    { name: 'John Doe', phone_number: '+1234567890' },
  );
  
  // Set permanent password
  await this.cognito.setPassword(email, 'NewPassword123!');
  
  return {
    username: result.username,
    status: result.status,
  };
}

async getUserDetails(email: string) {
  // Get user information
  const user = await this.cognito.getUser(email);
  
  return {
    email: user.attributes.email,
    name: user.attributes.name,
    status: user.status,
    created: user.created,
  };
}

async updateUser(email: string, attributes: Record<string, string>) {
  // Update user attributes
  await this.cognito.updateUserAttributes(email, attributes);
  
  return { message: 'User updated successfully' };
}

async listAllUsers() {
  // List users with pagination
  const result = await this.cognito.listUsers(60);
  
  return {
    users: result.users,
    nextToken: result.nextToken,
  };
}

async deactivateUser(email: string) {
  // Disable user account
  await this.cognito.disableUser(email);
  
  return { message: 'User disabled' };
}

async reactivateUser(email: string) {
  // Enable user account
  await this.cognito.enableUser(email);
  
  return { message: 'User enabled' };
}

async removeUser(email: string) {
  // Delete user permanently
  await this.cognito.deleteUser(email);
  
  return { message: 'User deleted' };
}
```

### JWT Token Validation (Create a Guard)

```typescript
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
    tokenUse: 'access',
    clientId: process.env.AWS_COGNITO_CLIENT_ID,
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const payload = await this.verifier.verify(token);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}

// Usage in controller
@Controller('protected')
@UseGuards(CognitoAuthGuard)
export class ProtectedController {
  @Get('profile')
  getProfile(@Request() req) {
    return { user: req.user };
  }
}
```

### Health Check & Metrics

```typescript
@Controller('health')
export class HealthController {
  constructor(private cognito: CognitoService) {}

  @Get('cognito')
  async checkCognito() {
    return await this.cognito.healthCheck();
  }

  @Get('metrics')
  getMetrics() {
    return this.cognito.getMetrics();
  }
}
```

## 🔒 Security Best Practices

### 1. Use Secret Hash
Always use a client secret in production for additional security.

### 2. Validate Tokens
Use JWT verification middleware/guards for protected routes.

### 3. Token Storage
- Store `refreshToken` in httpOnly cookies
- Store `accessToken` in memory (not localStorage)
- Never expose tokens in URLs

### 4. Password Requirements
Configure strong password policies in Cognito:
- Minimum 8 characters
- Require uppercase, lowercase, numbers, symbols

### 5. MFA Enforcement
Enable MFA for sensitive operations.

## 📊 Monitoring

### Error Tracking

```typescript
// Get service metrics
const metrics = cognitoService.getMetrics();

console.log(metrics);
// Output:
// {
//   totalRequests: 1523,
//   totalErrors: 12,
//   errorRate: '0.79%',
//   errorsByType: {
//     'UserNotFoundException': 8,
//     'InvalidPasswordException': 4
//   },
//   cache: {
//     configCached: true,
//     secretHashCacheSize: 45
//   }
// }
```

### Exception Filter Metrics

```typescript
const filter = new CognitoExceptionFilter();
// ... after some errors
const filterMetrics = filter.getMetrics();

console.log(filterMetrics);
// Output:
// {
//   totalErrors: 23,
//   errorsByStatus: {
//     '400': 15,
//     '401': 8
//   }
// }
```

## 🧪 Testing

```typescript
import { Test } from '@nestjs/testing';
import { CognitoService } from './cognito.service';

describe('CognitoService', () => {
  let service: CognitoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CognitoService],
    }).compile();

    service = module.get<CognitoService>(CognitoService);
  });

  it('should sign up a user', async () => {
    const result = await service.signUp(
      'test@example.com',
      'TestPassword123!',
    );

    expect(result.userId).toBeDefined();
    expect(result.confirmed).toBeDefined();
  });

  it('should handle invalid credentials', async () => {
    await expect(
      service.login('wrong@example.com', 'wrongpass'),
    ).rejects.toThrow();
  });
});
```

## 🐛 Error Handling

All errors are mapped to clean HTTP exceptions:

```typescript
try {
  await cognito.login(email, password);
} catch (error) {
  // Error structure:
  // {
  //   statusCode: 401,
  //   message: 'Invalid credentials or unauthorized access',
  //   error: 'Unauthorized',
  //   timestamp: '2024-01-01T00:00:00.000Z',
  //   path: '/auth/login',
  //   correlationId: 'abc-123'
  // }
}
```

### Common Error Codes

| Code | Error | Meaning |
|------|-------|---------|
| 400 | `CodeMismatchException` | Invalid verification code |
| 400 | `ExpiredCodeException` | Code expired, request new one |
| 400 | `InvalidPasswordException` | Password doesn't meet requirements |
| 401 | `NotAuthorizedException` | Invalid credentials |
| 403 | `UserNotConfirmedException` | Email not verified |
| 404 | `UserNotFoundException` | User doesn't exist |
| 409 | `UsernameExistsException` | User already exists |
| 429 | `TooManyRequestsException` | Rate limit exceeded |

## 🔄 Migration Guide

If you're migrating from another auth system:

1. Create users in Cognito
2. Set email as verified
3. Use `setPassword()` to set passwords
4. Optionally force password change on first login

```typescript
async migrateUser(email: string, hashedPassword: string) {
  // Create user
  await this.cognito.adminCreateUser(
    email,
    'TempPassword123!',
    true, // Email verified
  );
  
  // Set actual password
  await this.cognito.setPassword(email, hashedPassword);
}
```

## 📝 License

MIT

## 🤝 Contributing

Contributions welcome! This is a production-ready, standalone service designed to be dropped into any NestJS project.

## 🆘 Support

For AWS Cognito configuration help:
- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [NestJS Documentation](https://docs.nestjs.com/)

---

**Ready to use in production!** 🚀