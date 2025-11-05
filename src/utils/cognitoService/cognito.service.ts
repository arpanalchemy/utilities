import {
  Injectable,
  Logger,
  InternalServerErrorException,
  HttpException,
  HttpStatus,
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
} from '@aws-sdk/client-cognito-identity-provider';
import { SecretsService } from '../secretsService/secrets.service';
import { createHmac } from 'crypto';
import { NodeHttpHandler } from '@smithy/node-http-handler';

/**
 * Production-Optimized Cognito Service
 * - Zero external dependencies (no filters needed)
 * - Built-in caching (config, client, secret hash)
 * - Clean error handling (no stack traces)
 * - Request timeouts & retries configured
 * - Simple metrics collection
 */
@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);

  // Caching for performance
  private cognitoClient: CognitoIdentityProviderClient | null = null;
  private configCache: { userPoolId: string; clientId: string; clientSecret?: string } | null = null;
  private configCacheTime = 0;
  private secretHashCache = new Map<string, string>();
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Simple metrics
  private metrics = {
    requests: 0,
    errors: 0,
    errorsByType: new Map<string, number>(),
  };

  constructor(private secretService?: SecretsService) {}

  /**
   * AWS SDK Client configuration with timeouts and retries
   */
  private getAWSConfig() {
    const region = process.env.AWS_REGION;
    if (!region) {
      throw new InternalServerErrorException('AWS_REGION is not set');
    }
    return { region };
  }

  /**
   * Get or create Cognito client (singleton with connection pooling)
   */
  private getClient() {
    if (!this.cognitoClient) {
      this.cognitoClient = new CognitoIdentityProviderClient({
        region: this.getAWSConfig().region,
        requestHandler: new NodeHttpHandler({
          connectionTimeout: 3000, // 3 seconds
          socketTimeout: 5000,     // 5 seconds
        }),
        maxAttempts: 3, // Retry failed requests up to 3 times
      });
      this.logger.log('Cognito client initialized');
    }
    return this.cognitoClient;
  }

  /**
   * Fetch Cognito config with 5-minute caching
   */
  private async getCognitoConfig() {
    const now = Date.now();
    
    // Return cached config if still valid
    if (this.configCache && now - this.configCacheTime < this.CONFIG_CACHE_TTL) {
      return this.configCache;
    }

    let userPoolId: string | undefined;
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    // Try Secrets Manager first (silent failure)
    if (this.secretService) {
      try {
        userPoolId = await this.secretService.getSecret('cognito', 'user_pool_id');
        clientId = await this.secretService.getSecret('cognito', 'client_id');
        clientSecret = await this.secretService.getSecret('cognito', 'client_secret');
      } catch {
        // Silent - fallback to env vars
      }
    }

    // Fallback to environment variables
    userPoolId = userPoolId || process.env.AWS_COGNITO_USER_POOL_ID;
    clientId = clientId || process.env.AWS_COGNITO_CLIENT_ID;
    clientSecret = clientSecret || process.env.AWS_COGNITO_CLIENT_SECRET;

    if (!userPoolId || !clientId) {
      throw new InternalServerErrorException('Cognito configuration missing');
    }

    // Cache the configuration
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
    
    // Return cached hash if exists
    if (this.secretHashCache.has(cacheKey)) {
      return this.secretHashCache.get(cacheKey);
    }

    // Compute and cache
    const hmac = createHmac('sha256', clientSecret);
    hmac.update(username + clientId);
    const hash = hmac.digest('base64');
    
    this.secretHashCache.set(cacheKey, hash);
    
    // Clear old cache entries if too large (prevent memory leak)
    if (this.secretHashCache.size > 1000) {
      const firstKey = this.secretHashCache.keys().next().value;
      this.secretHashCache.delete(firstKey);
    }
    
    return hash;
  }

  /**
   * Sanitize email for logging (privacy-friendly)
   */
  private sanitize(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    return `${local.charAt(0)}***@${domain}`;
  }

  /**
   * Execute wrapper with clean error handling and metrics
   * NO STACK TRACES EVER
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
      
      // Track error types
      const count = this.metrics.errorsByType.get(errorName) || 0;
      this.metrics.errorsByType.set(errorName, count + 1);

      // Minimal error log - just operation and error type
      this.logger.error(`${operationName}: ${errorName}`);

      // Map AWS errors to HTTP exceptions
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
      };

      const errorConfig = errorMap[errorName];

      if (errorConfig) {
        const exception = new HttpException(
          {
            statusCode: errorConfig.status,
            message: errorConfig.message,
            error: HttpStatus[errorConfig.status],
          },
          errorConfig.status,
        );
        
        // CRITICAL: Remove stack trace to prevent NestJS from logging it
        delete (exception as any).stack;
        throw exception;
      }

      // Unknown error
      const exception = new InternalServerErrorException('An unexpected error occurred');
      delete (exception as any).stack;
      throw exception;
    }
  }

  // ===========================================================================
  // 🧩 AUTHENTICATION & USER MANAGEMENT
  // ===========================================================================

  async signUp(email: string, password: string): Promise<any> {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(email);

      const command = new SignUpCommand({
        ClientId: clientId,
        Username: email,
        Password: password,
        UserAttributes: [{ Name: 'email', Value: email }],
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      const result = await client.send(command);
      this.logger.log(`Sign-up: ${this.sanitize(email)}`);
      return result;
    }, 'signUp');
  }

  async confirmSignUp(username: string, code: string): Promise<any> {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: code,
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      const result = await client.send(command);
      this.logger.log(`Confirmed: ${this.sanitize(username)}`);
      return result;
    }, 'confirmSignUp');
  }

  async adminConfirmSignUp(username: string): Promise<any> {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminConfirmSignUpCommand({
        Username: username,
        UserPoolId: userPoolId,
      });

      const result = await client.send(command);
      this.logger.log(`Admin confirmed: ${this.sanitize(username)}`);
      return result;
    }, 'adminConfirmSignUp');
  }

  async adminCreateUser(email: string, tempPassword: string, verified = false): Promise<any> {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const attributes = [{ Name: 'email', Value: email }];
      if (verified) attributes.push({ Name: 'email_verified', Value: 'true' });

      const command = new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: email,
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS',
        UserAttributes: attributes,
      });

      const result = await client.send(command);
      this.logger.log(`User created: ${this.sanitize(email)}`);
      return result;
    }, 'adminCreateUser');
  }

  async setPassword(username: string, newPassword: string): Promise<any> {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminSetUserPasswordCommand({
        Username: username,
        Password: newPassword,
        UserPoolId: userPoolId,
        Permanent: true,
      });

      const result = await client.send(command);
      this.logger.log(`Password set: ${this.sanitize(username)}`);
      return result;
    }, 'setPassword');
  }

  async adminLogin(username: string, password: string): Promise<any> {
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
          ...(secretHash ? { SECRET_HASH: secretHash } : {}),
        },
      });

      const response = await client.send(command);

      if (response.ChallengeName === 'SOFTWARE_TOKEN_MFA' || response.ChallengeName === 'SMS_MFA') {
        this.logger.log(`MFA required: ${this.sanitize(username)}`);
        return { challenge: response.ChallengeName, session: response.Session };
      }

      this.logger.log(`Login success: ${this.sanitize(username)}`);
      return response.AuthenticationResult;
    }, 'adminLogin');
  }

  async verifyMFA(username: string, session: string, code: string): Promise<any> {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new RespondToAuthChallengeCommand({
        ClientId: clientId,
        ChallengeName: 'SOFTWARE_TOKEN_MFA',
        Session: session,
        ChallengeResponses: {
          USERNAME: username,
          SOFTWARE_TOKEN_MFA_CODE: code,
        },
      });

      const result = await client.send(command);
      this.logger.log(`MFA verified: ${this.sanitize(username)}`);
      return result;
    }, 'verifyMFA');
  }

  async setupMFA(accessToken: string): Promise<any> {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new AssociateSoftwareTokenCommand({ AccessToken: accessToken });
      const result = await client.send(command);
      this.logger.log('MFA setup initiated');
      return result;
    }, 'setupMFA');
  }

  async confirmMFA(accessToken: string, code: string): Promise<any> {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: code,
        FriendlyDeviceName: 'Primary Device',
      });

      const result = await client.send(command);
      this.logger.log('MFA confirmed');
      return result;
    }, 'confirmMFA');
  }

  // ===========================================================================
  // 🔁 TOKEN MANAGEMENT
  // ===========================================================================

  async refreshToken(refreshToken: string): Promise<any> {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      });

      const result = await client.send(command);
      this.logger.log('Token refreshed');
      return result;
    }, 'refreshToken');
  }

  // ===========================================================================
  // 🔧 USER MAINTENANCE
  // ===========================================================================

  async forgotPassword(username: string): Promise<any> {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new ForgotPasswordCommand({
        ClientId: clientId,
        Username: username,
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      const result = await client.send(command);
      this.logger.log(`Password reset: ${this.sanitize(username)}`);
      return result;
    }, 'forgotPassword');
  }

  async confirmForgotPassword(username: string, code: string, newPassword: string): Promise<any> {
    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new ConfirmForgotPasswordCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: code,
        Password: newPassword,
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      const result = await client.send(command);
      this.logger.log(`Password confirmed: ${this.sanitize(username)}`);
      return result;
    }, 'confirmForgotPassword');
  }

  async updateUserAttributes(username: string, attributes: Record<string, string>): Promise<any> {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: username,
        UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({ Name, Value })),
      });

      const result = await client.send(command);
      this.logger.log(`Attributes updated: ${this.sanitize(username)}`);
      return result;
    }, 'updateUserAttributes');
  }

  async getUser(username: string): Promise<any> {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      });

      const result = await client.send(command);
      this.logger.log(`User retrieved: ${this.sanitize(username)}`);
      return result;
    }, 'getUser');
  }

  async globalSignOut(accessToken: string): Promise<any> {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new GlobalSignOutCommand({ AccessToken: accessToken });
      const result = await client.send(command);
      this.logger.log('Global sign-out');
      return result;
    }, 'globalSignOut');
  }

  // ===========================================================================
  // 📊 METRICS & HEALTH
  // ===========================================================================

  /**
   * Get service metrics (for monitoring/health checks)
   */
  getMetrics() {
    return {
      totalRequests: this.metrics.requests,
      totalErrors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 
        ? ((this.metrics.errors / this.metrics.requests) * 100).toFixed(2) + '%'
        : '0%',
      errorsByType: Object.fromEntries(this.metrics.errorsByType),
      cacheStats: {
        configCached: !!this.configCache,
        secretHashCacheSize: this.secretHashCache.size,
      },
    };
  }

  /**
   * Clear caches (useful for testing or forcing refresh)
   */
  clearCaches() {
    this.configCache = null;
    this.configCacheTime = 0;
    this.secretHashCache.clear();
    this.logger.log('Caches cleared');
  }
}