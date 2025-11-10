import {
  Injectable,
  Inject,
  Logger,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  AdminInitiateAuthCommand,
  AdminConfirmSignUpCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AdminUpdateUserAttributesCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  ListUsersCommand,
  GetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { createHmac } from 'crypto';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { SecretsService } from '../secretsService/secrets.service';

/**
 * Production-Ready AWS Cognito Service
 * 
 * Features:
 * - Complete authentication flow (signup, login, MFA, password reset)
 * - JWT token management (access, refresh, ID tokens)
 * - Admin operations (user management, CRUD)
 * - Built-in caching (config, client, secret hash)
 * - Request timeouts & retries
 * - Clean error handling (no stack traces)
 * - Privacy-safe logging
 * - Metrics & health monitoring
 * - Memory leak prevention
 * - Graceful shutdown
 * 
 * Usage:
 * 1. Set environment variables:
 *    - AWS_REGION
 *    - AWS_COGNITO_USER_POOL_ID
 *    - AWS_COGNITO_CLIENT_ID
 *    - AWS_COGNITO_CLIENT_SECRET (optional)
 * 
 * 2. Import in your module:
 *    providers: [CognitoService]
 * 
 * 3. Inject and use:
 *    constructor(private cognito: CognitoService) {}
 */
@Injectable()
export class CognitoService implements OnModuleDestroy {
  private readonly logger = new Logger(CognitoService.name);
    constructor(
    @Inject(SecretsService)
    private readonly secretService: SecretsService
  ) {}


  // Singleton client with connection pooling
  private cognitoClient: CognitoIdentityProviderClient | null = null;
  
  // Configuration caching
  private configCache: { 
    userPoolId: string; 
    clientId: string; 
    clientSecret?: string;
  } | null = null;
  private configCacheTime = 0;
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Secret hash caching (performance optimization)
  private secretHashCache = new Map<string, string>();
  private readonly MAX_CACHE_SIZE = 1000;

  // Metrics for monitoring
  private metrics = {
    requests: 0,
    errors: 0,
    errorsByType: new Map<string, number>(),
    lastError: null as { type: string; time: Date } | null,
  };

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    this.logger.log('Cleaning up Cognito service...');
    
    if (this.cognitoClient) {
      this.cognitoClient.destroy();
      this.cognitoClient = null;
    }
    
    this.clearCaches();
    this.logger.log('Cognito service cleanup complete');
  }

  /**
   * Get AWS SDK configuration
   */
  private getAWSConfig() {
    const region = process.env.AWS_REGION;
    if (!region) {
      throw new InternalServerErrorException('AWS_REGION environment variable is not configured');
    }
    return { region };
  }

  /**
   * Get or create Cognito client (singleton pattern)
   */
  private getClient(): CognitoIdentityProviderClient {
    if (!this.cognitoClient) {
      this.cognitoClient = new CognitoIdentityProviderClient({
        region: this.getAWSConfig().region,
        requestHandler: new NodeHttpHandler({
          connectionTimeout: 3000,
          socketTimeout: 5000,
        }),
        maxAttempts: 3,
      });
      this.logger.log('Cognito client initialized');
    }
    return this.cognitoClient;
  }

  /**
   * Fetch Cognito configuration with caching
   */
  private async getCognitoConfig() {
    const now = Date.now();
    
    if (this.configCache && now - this.configCacheTime < this.CONFIG_CACHE_TTL) {
      return this.configCache;
    }

    let userPoolId: string | undefined;
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    // First try to get from environment variables
    userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    clientId = process.env.AWS_COGNITO_CLIENT_ID;
    clientSecret = process.env.AWS_COGNITO_CLIENT_SECRET;

    // If any required config is missing from env vars, try secret service
    if ((!userPoolId || !clientId) && this.secretService) {
      try {
        this.logger.debug('Fetching Cognito config from secret service');
        if (!userPoolId) {
          userPoolId = await this.secretService.getSecret('cognito', 'user_pool_id');
        }
        if (!clientId) {
          clientId = await this.secretService.getSecret('cognito', 'client_id');
        }
        if (!clientSecret) {
          clientSecret = await this.secretService.getSecret('cognito', 'client_secret');
        }
        this.logger.log('Cognito config loaded from secret service');
      } catch (error) {
        this.logger.warn('Failed to fetch from secret service: ' + error.message);
      }
    }

    if (!userPoolId || !clientId) {
      throw new InternalServerErrorException(
        'AWS Cognito configuration missing. Set AWS_COGNITO_USER_POOL_ID and AWS_COGNITO_CLIENT_ID'
      );
    }

    this.configCache = { userPoolId, clientId, clientSecret };
    this.configCacheTime = now;

    return this.configCache;
  }

  /**
   * Compute secret hash with caching
   */
  private async computeSecretHash(username: string): Promise<string | undefined> {
    const { clientId, clientSecret } = await this.getCognitoConfig();
    if (!clientSecret) return undefined;

    const cacheKey = `${username}:${clientId}`;
    
    if (this.secretHashCache.has(cacheKey)) {
      return this.secretHashCache.get(cacheKey);
    }

    const hmac = createHmac('sha256', clientSecret);
    hmac.update(username + clientId);
    const hash = hmac.digest('base64');
    
    this.secretHashCache.set(cacheKey, hash);
    
    // Prevent memory leak
    if (this.secretHashCache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.secretHashCache.keys().next().value;
      this.secretHashCache.delete(firstKey);
    }
    
    return hash;
  }

  /**
   * Sanitize email for privacy-safe logging
   */
  private sanitize(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    return `${local.charAt(0)}***@${domain}`;
  }

  /**
   * Execute wrapper with error handling and metrics
   */
  private async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    this.metrics.requests++;
    
    try {
      return await operation();
    } catch (error: any) {
      this.metrics.errors++;
      const errorName = error.name || 'UnknownError';
      
      this.metrics.errorsByType.set(
        errorName,
        (this.metrics.errorsByType.get(errorName) || 0) + 1
      );
      this.metrics.lastError = { type: errorName, time: new Date() };

      this.logger.error(`${operationName} failed: ${errorName}`);

      // Map AWS Cognito errors to HTTP exceptions
      const errorMap: Record<string, { status: HttpStatus; message: string }> = {
        CodeMismatchException: {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid verification code provided',
        },
        ExpiredCodeException: {
          status: HttpStatus.BAD_REQUEST,
          message: 'Verification code has expired, please request a new one',
        },
        UserNotFoundException: {
          status: HttpStatus.NOT_FOUND,
          message: 'User not found',
        },
        NotAuthorizedException: {
          status: HttpStatus.UNAUTHORIZED,
          message: 'Invalid credentials or unauthorized access',
        },
        UsernameExistsException: {
          status: HttpStatus.CONFLICT,
          message: 'User already exists',
        },
        InvalidPasswordException: {
          status: HttpStatus.BAD_REQUEST,
          message: 'Password does not meet security requirements',
        },
        InvalidParameterException: {
          status: HttpStatus.BAD_REQUEST,
          message: 'Invalid parameters provided',
        },
        TooManyRequestsException: {
          status: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests, please try again later',
        },
        UserNotConfirmedException: {
          status: HttpStatus.FORBIDDEN,
          message: 'Please verify your email before logging in',
        },
        LimitExceededException: {
          status: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Request limit exceeded',
        },
        TooManyFailedAttemptsException: {
          status: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many failed attempts, account temporarily locked',
        },
        PasswordResetRequiredException: {
          status: HttpStatus.FORBIDDEN,
          message: 'Password reset required',
        },
      };

      const errorConfig = errorMap[errorName];

      if (errorConfig) {
        const exception = new HttpException(
          {
            statusCode: errorConfig.status,
            message: errorConfig.message,
            error: HttpStatus[errorConfig.status],
            timestamp: new Date().toISOString(),
          },
          errorConfig.status,
        );
        
        delete (exception as any).stack;
        throw exception;
      }

      // Unknown error - sanitized response
      const exception = new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        error: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
      delete (exception as any).stack;
      throw exception;
    }
  }

  // ===========================================================================
  // 🔐 AUTHENTICATION FLOW
  // ===========================================================================

  /**
   * Sign up a new user
   * Returns: { UserSub, UserConfirmed, CodeDeliveryDetails }
   */
  async signUp(email: string, password: string, attributes?: Record<string, string>) {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(email);

      const userAttributes = [{ Name: 'email', Value: email }];
      if (attributes) {
        userAttributes.push(
          ...Object.entries(attributes).map(([Name, Value]) => ({ Name, Value }))
        );
      }

      const command = new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: password,
        UserAttributes: userAttributes,
        ...(secretHash && { SecretHash: secretHash }),
      });

      const result = await client.send(command);
      this.logger.log(`User signed up: ${this.sanitize(email)}`);
      
      return {
        userId: result.UserSub,
        confirmed: result.UserConfirmed,
        codeDelivery: result.CodeDeliveryDetails,
      };
    }, 'signUp');
  }

  /**
   * Confirm user sign up with verification code
   */
  async confirmSignUp(username: string, code: string) {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: code,
        ...(secretHash && { SecretHash: secretHash }),
      });

      await client.send(command);
      this.logger.log(`User confirmed: ${this.sanitize(username)}`);
      
      return { success: true, message: 'User confirmed successfully' };
    }, 'confirmSignUp');
  }

  /**
   * Admin confirm user (skip email verification)
   */
  async adminConfirmSignUp(username: string) {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminConfirmSignUpCommand({
        Username: username,
        UserPoolId: userPoolId,
      });

      await client.send(command);
      this.logger.log(`Admin confirmed user: ${this.sanitize(username)}`);
      
      return { success: true, message: 'User confirmed by admin' };
    }, 'adminConfirmSignUp');
  }

  /**
   * User login - Returns JWT tokens or MFA challenge
   * Returns: { accessToken, idToken, refreshToken } OR { challenge, session }
   */
  async login(username: string, password: string) {
    return this.execute(async () => {
      const { userPoolId, clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new AdminInitiateAuthCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          ...(secretHash && { SECRET_HASH: secretHash }),
        },
      });

      const response = await client.send(command);

      // Handle MFA challenge
      if (response.ChallengeName === 'SOFTWARE_TOKEN_MFA' || response.ChallengeName === 'SMS_MFA') {
        this.logger.log(`MFA challenge for: ${this.sanitize(username)}`);
        return {
          requiresMFA: true,
          challenge: response.ChallengeName,
          session: response.Session,
        };
      }

      // Handle new password required
      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        this.logger.log(`New password required: ${this.sanitize(username)}`);
        return {
          requiresNewPassword: true,
          session: response.Session,
        };
      }

      const auth = response.AuthenticationResult;
      this.logger.log(`User logged in: ${this.sanitize(username)}`);
      
      return {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken,
        expiresIn: auth.ExpiresIn,
        tokenType: auth.TokenType,
      };
    }, 'login');
  }

  /**
   * Verify MFA code and complete login
   */
  async verifyMFA(username: string, session: string, code: string, challengeName = 'SOFTWARE_TOKEN_MFA') {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: challengeName as any,
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          SOFTWARE_TOKEN_MFA_CODE: code,
          ...(secretHash && { SECRET_HASH: secretHash }),
        },
      });

      const response = await client.send(command);
      const auth = response.AuthenticationResult;
      
      this.logger.log(`MFA verified: ${this.sanitize(username)}`);
      
      return {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken,
        expiresIn: auth.ExpiresIn,
        tokenType: auth.TokenType,
      };
    }, 'verifyMFA');
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string) {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      });

      const response = await client.send(command);
      const auth = response.AuthenticationResult;
      
      this.logger.log('Access token refreshed');
      
      return {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        expiresIn: auth.ExpiresIn,
        tokenType: auth.TokenType,
      };
    }, 'refreshToken');
  }

  /**
   * Global sign out - Invalidates all tokens
   */
  async globalSignOut(accessToken: string) {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new GlobalSignOutCommand({ AccessToken: accessToken });
      
      await client.send(command);
      this.logger.log('User signed out globally');
      
      return { success: true, message: 'Signed out successfully' };
    }, 'globalSignOut');
  }

  // ===========================================================================
  // 🔑 PASSWORD MANAGEMENT
  // ===========================================================================

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(username: string) {
    try {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      this.logger.debug(`Initiating password reset for: ${this.sanitize(username)}`);
      this.logger.debug(`Using clientId: ${clientId}`);
      this.logger.debug(`Secret hash computed: ${!!secretHash}`);

      const command = new ForgotPasswordCommand({
        ClientId: clientId,
        Username: username,
        ...(secretHash && { SecretHash: secretHash }),
      });

      this.logger.debug('Sending ForgotPasswordCommand to Cognito');
      const result = await client.send(command);
      
      this.logger.log(`Password reset initiated: ${this.sanitize(username)}`);
      this.logger.debug(`Code delivery details: ${JSON.stringify(result.CodeDeliveryDetails)}`);
      
      return {
        codeDelivery: result.CodeDeliveryDetails,
        message: 'Password reset code sent',
      };
    } catch (error) {
      this.logger.error(`Failed to initiate password reset for ${this.sanitize(username)}: ${error.message}`);
      this.logger.debug(`Error details: ${JSON.stringify({
        name: error.name,
        code: error.code,
        statusCode: error.$metadata?.httpStatusCode,
      })}`);
      throw error;
    }
  }

  /**
   * Confirm forgot password with code and new password
   */
  async confirmForgotPassword(username: string, code: string, newPassword: string) {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: code,
        Password: newPassword,
        ...(secretHash && { SecretHash: secretHash }),
      });

      await client.send(command);
      this.logger.log(`Password reset confirmed: ${this.sanitize(username)}`);
      
      return { success: true, message: 'Password reset successfully' };
    }, 'confirmForgotPassword');
  }

  /**
   * Admin set user password (permanent)
   */
  async setPassword(username: string, newPassword: string, permanent = true) {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminSetUserPasswordCommand({
        Username: username,
        Password: newPassword,
        UserPoolId: userPoolId,
        Permanent: permanent,
      });

      await client.send(command);
      this.logger.log(`Password set for: ${this.sanitize(username)}`);
      
      return { success: true, message: 'Password updated successfully' };
    }, 'setPassword');
  }

  // ===========================================================================
  // 👤 USER MANAGEMENT
  // ===========================================================================

  /**
   * Admin create user with temporary password
   */
  async adminCreateUser(
    email: string, 
    tempPassword: string, 
    verified = false,
    attributes?: Record<string, string>
  ) {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const userAttributes = [{ Name: 'email', Value: email }];
      if (verified) userAttributes.push({ Name: 'email_verified', Value: 'true' });
      if (attributes) {
        userAttributes.push(
          ...Object.entries(attributes).map(([Name, Value]) => ({ Name, Value }))
        );
      }

      const command = new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS',
        UserAttributes: userAttributes,
      });

      const result = await client.send(command);
      this.logger.log(`Admin created user: ${this.sanitize(email)}`);
      
      return {
        username: result.User.Username,
        status: result.User.UserStatus,
        enabled: result.User.Enabled,
        created: result.User.UserCreateDate,
      };
    }, 'adminCreateUser');
  }

  /**
   * Get user details
   */
  async getUser(username: string) {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      });

      const result = await client.send(command);
      this.logger.log(`User details retrieved: ${this.sanitize(username)}`);
      
      const attributes = result.UserAttributes?.reduce((acc, attr) => {
        acc[attr.Name] = attr.Value;
        return acc;
      }, {} as Record<string, string>);

      return {
        username: result.Username,
        status: result.UserStatus,
        enabled: result.Enabled,
        created: result.UserCreateDate,
        modified: result.UserLastModifiedDate,
        attributes,
      };
    }, 'getUser');
  }

  /**
   * Get current user details from access token
   */
  async getCurrentUser(accessToken: string) {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new GetUserCommand({ AccessToken: accessToken });

      const result = await client.send(command);
      
      const attributes = result.UserAttributes?.reduce((acc, attr) => {
        acc[attr.Name] = attr.Value;
        return acc;
      }, {} as Record<string, string>);

      return {
        username: result.Username,
        attributes,
      };
    }, 'getCurrentUser');
  }

  /**
   * Update user attributes
   */
  async updateUserAttributes(username: string, attributes: Record<string, string>) {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: username,
        UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({ Name, Value })),
      });

      await client.send(command);
      this.logger.log(`User attributes updated: ${this.sanitize(username)}`);
      
      return { success: true, message: 'User attributes updated' };
    }, 'updateUserAttributes');
  }

  /**
   * Delete user
   */
  async deleteUser(username: string) {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      });

      await client.send(command);
      this.logger.log(`User deleted: ${this.sanitize(username)}`);
      
      return { success: true, message: 'User deleted successfully' };
    }, 'deleteUser');
  }

  /**
   * Disable user account
   */
  async disableUser(username: string) {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminDisableUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      });

      await client.send(command);
      this.logger.log(`User disabled: ${this.sanitize(username)}`);
      
      return { success: true, message: 'User disabled successfully' };
    }, 'disableUser');
  }

  /**
   * Enable user account
   */
  async enableUser(username: string) {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminEnableUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      });

      await client.send(command);
      this.logger.log(`User enabled: ${this.sanitize(username)}`);
      
      return { success: true, message: 'User enabled successfully' };
    }, 'enableUser');
  }

  /**
   * List users with optional filtering
   */
  async listUsers(limit = 60, paginationToken?: string, filter?: string) {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new ListUsersCommand({
        UserPoolId: userPoolId,
        Limit: limit,
        PaginationToken: paginationToken,
        Filter: filter,
      });

      const result = await client.send(command);
      this.logger.log(`Listed ${result.Users?.length || 0} users`);
      
      const users = result.Users?.map(user => ({
        username: user.Username,
        status: user.UserStatus,
        enabled: user.Enabled,
        created: user.UserCreateDate,
        modified: user.UserLastModifiedDate,
        attributes: user.Attributes?.reduce((acc, attr) => {
          acc[attr.Name] = attr.Value;
          return acc;
        }, {} as Record<string, string>),
      }));

      return {
        users,
        nextToken: result.PaginationToken,
      };
    }, 'listUsers');
  }

  // ===========================================================================
  // 🔒 MFA MANAGEMENT
  // ===========================================================================

  /**
   * Setup MFA - Get QR code secret
   */
  async setupMFA(accessToken: string) {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new AssociateSoftwareTokenCommand({ AccessToken: accessToken });
      
      const result = await client.send(command);
      this.logger.log('MFA setup initiated');
      
      return {
        secretCode: result.SecretCode,
        session: result.Session,
      };
    }, 'setupMFA');
  }

  /**
   * Confirm MFA setup with TOTP code
   */
  async confirmMFA(accessToken: string, code: string, friendlyDeviceName = 'Primary Device') {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: code,
        FriendlyDeviceName: friendlyDeviceName,
      });

      const result = await client.send(command);
      this.logger.log('MFA confirmed and enabled');
      
      return {
        status: result.Status,
        session: result.Session,
        message: 'MFA enabled successfully',
      };
    }, 'confirmMFA');
  }

  // ===========================================================================
  // 📊 MONITORING & HEALTH
  // ===========================================================================

  /**
   * Get service metrics for monitoring
   */
  getMetrics() {
    return {
      totalRequests: this.metrics.requests,
      totalErrors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 
        ? `${((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)}%`
        : '0%',
      errorsByType: Object.fromEntries(this.metrics.errorsByType),
      lastError: this.metrics.lastError,
      cache: {
        configCached: !!this.configCache,
        secretHashCacheSize: this.secretHashCache.size,
      },
      client: {
        initialized: !!this.cognitoClient,
      },
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      const { userPoolId } = await this.getCognitoConfig();
      return {
        status: 'healthy',
        service: 'CognitoService',
        timestamp: new Date().toISOString(),
        config: {
          userPoolId: userPoolId?.substring(0, 10) + '***',
          region: process.env.AWS_REGION,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'CognitoService',
        timestamp: new Date().toISOString(),
        error: 'Configuration error',
      };
    }
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.configCache = null;
    this.configCacheTime = 0;
    this.secretHashCache.clear();
    this.logger.log('All caches cleared');
  }

  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      requests: 0,
      errors: 0,
      errorsByType: new Map(),
      lastError: null,
    };
    this.logger.log('Metrics reset');
  }
}