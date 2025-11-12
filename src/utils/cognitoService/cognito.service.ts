import {
  Injectable,
  Inject,
  Optional,
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
import { verify, decode, JwtPayload } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { SecretsService } from '../secretsService/secrets.service';

// ============================================================================
// TYPES & INTERFACES - Exported for consumer use
// ============================================================================

export enum ChallengeNameType {
  SOFTWARE_TOKEN_MFA = 'SOFTWARE_TOKEN_MFA',
  SMS_MFA = 'SMS_MFA',
  NEW_PASSWORD_REQUIRED = 'NEW_PASSWORD_REQUIRED',
}

export enum UserStatus {
  UNCONFIRMED = 'UNCONFIRMED',
  CONFIRMED = 'CONFIRMED',
  ARCHIVED = 'ARCHIVED',
  COMPROMISED = 'COMPROMISED',
  UNKNOWN = 'UNKNOWN',
  RESET_REQUIRED = 'RESET_REQUIRED',
  FORCE_CHANGE_PASSWORD = 'FORCE_CHANGE_PASSWORD',
}

export interface SignUpResponse {
  userId?: string;
  confirmed?: boolean;
  codeDelivery?: any;
}

export interface LoginResponse {
  accessToken?: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
}

export interface MFAChallengeResponse {
  requiresMFA: true;
  challenge: string;
  session: string;
}

export interface NewPasswordRequiredResponse {
  requiresNewPassword: true;
  session: string;
}

export interface UserDetails {
  username?: string;
  status?: string;
  enabled?: boolean;
  created?: Date;
  modified?: Date;
  attributes?: Record<string, string>;
}

export interface TokenPayload extends JwtPayload {
  sub: string; 
  email?: string;
  email_verified?: boolean;
  'cognito:username'?: string;
  'cognito:groups'?: string[];
}

export interface VerifyTokenResponse {
  valid: boolean;
  payload?: TokenPayload;
  expired?: boolean;
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

/**
 * Production-Ready AWS Cognito Service
 * 
 * Features:
 * - Complete authentication flow (signup, login, MFA, password reset)
 * - JWT token validation and verification
 * - Input validation and sanitization
 * - Admin operations (user management, CRUD)
 * - Built-in caching (config, client, secret hash)
 * - Request timeouts & retries
 * - Clean error handling
 * - Privacy-safe logging
 * - Metrics & health monitoring
 * - Memory leak prevention
 * - Graceful shutdown
 * 
 * @example
 * ```typescript
 * // In your module
 * @Module({
 *   providers: [CognitoService],
 *   exports: [CognitoService],
 * })
 * 
 * // In your controller
 * constructor(private cognito: CognitoService) {}
 * 
 * async signup() {
 *   const result = await this.cognito.signUp('user@example.com', 'Pass123!');
 *   return result;
 * }
 * ```
 */
@Injectable()
export class CognitoService implements OnModuleDestroy {
  private readonly logger = new Logger(CognitoService.name);

  // Constants
  private readonly CONNECTION_TIMEOUT = 3000;
  private readonly SOCKET_TIMEOUT = 5000;
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly DEFAULT_USER_LIST_LIMIT = 60;
  private readonly CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly MAX_INPUT_LENGTH = 1000;
  private readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private readonly CODE_REGEX = /^\d{6}$/;

  constructor(
    @Optional()
    @Inject(SecretsService)
    private readonly secretService?: SecretsService,
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

  // Secret hash caching
  private secretHashCache = new Map<string, string>();

  // Token blacklist
  private tokenBlacklist = new Map<string, { expiresAt: number; revokedAt: number }>();

  // JWKS client cache
  private jwksClientCache: jwksClient.JwksClient | null = null;

  // Metrics for monitoring
  private metrics = {
    requests: 0,
    errors: 0,
    errorsByType: new Map<string, number>(),
    lastError: null as { type: string; time: Date } | null,
    requestTimes: [] as number[],
  };

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

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

  // ============================================================================
  // VALIDATION & SANITIZATION
  // ============================================================================

  /**
   * Validate email format
   * @param email - Email address to validate
   * @throws {HttpException} If email is invalid
   */
  private validateEmail(email: string): void {
    if (!email || typeof email !== 'string') {
      throw new HttpException('Email is required', HttpStatus.BAD_REQUEST);
    }
    
    const sanitized = email.trim();
    if (!this.EMAIL_REGEX.test(sanitized)) {
      throw new HttpException('Invalid email format', HttpStatus.BAD_REQUEST);
    }
    
    if (sanitized.length > this.MAX_INPUT_LENGTH) {
      throw new HttpException('Email exceeds maximum length', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Validate required string parameter
   * @param value - Value to validate
   * @param fieldName - Name of the field for error messages
   * @throws {HttpException} If value is invalid
   */
  private validateRequired(value: string, fieldName: string): void {
    if (!value || typeof value !== 'string' || value.trim() === '') {
      throw new HttpException(`${fieldName} is required`, HttpStatus.BAD_REQUEST);
    }
    
    if (value.length > this.MAX_INPUT_LENGTH) {
      throw new HttpException(`${fieldName} exceeds maximum length`, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Validate verification code format (6 digits)
   * @param code - Code to validate
   * @throws {HttpException} If code is invalid
   */
  private validateCode(code: string): void {
    if (!code || !this.CODE_REGEX.test(code)) {
      throw new HttpException(
        'Invalid verification code format. Expected 6 digits.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Sanitize user input to prevent injection attacks
   * @param input - Input string to sanitize
   * @returns Sanitized string
   */
  private sanitizeInput(input: string): string {
    if (!input) return '';
    
    return input
      .trim()
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .slice(0, this.MAX_INPUT_LENGTH);
  }

  /**
   * Validate and sanitize user attributes
   * @param attributes - User attributes object
   * @returns Sanitized attributes
   */
  private sanitizeAttributes(attributes: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const allowedKeys = ['name', 'family_name', 'phone_number', 'birthdate', 'gender', 'address'];
    
    for (const [key, value] of Object.entries(attributes)) {
      if (!allowedKeys.includes(key)) {
        this.logger.warn(`Ignoring invalid attribute key: ${key}`);
        continue;
      }
      
      sanitized[key] = this.sanitizeInput(value);
    }
    
    return sanitized;
  }

  /**
   * Sanitize email for privacy-safe logging
   * @param email - Email to sanitize
   * @returns Sanitized email
   */
  private sanitize(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    return `${local.charAt(0)}***@${domain}`;
  }

  // ============================================================================
  // JWT TOKEN VALIDATION
  // ============================================================================

  /**
   * Get JWKS client for token verification
   * @returns JWKS client instance
   */
  private async getJWKSClient(): Promise<jwksClient.JwksClient> {
    if (this.jwksClientCache) {
      return this.jwksClientCache;
    }

    const { userPoolId } = await this.getCognitoConfig();
    const region = this.getAWSConfig().region;
    
    this.jwksClientCache = jwksClient({
      jwksUri: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
    });

    return this.jwksClientCache;
  }

  /**
   * Verify JWT token signature and claims
   * @param token - JWT token to verify
   * @returns Decoded and verified token payload
   * @throws {HttpException} If token is invalid
   * @example
   * ```typescript
   * const payload = await cognitoService.verifyToken(accessToken);
   * console.log(payload.sub, payload.email);
   * ```
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    this.validateRequired(token, 'Token');

    // Check if token is blacklisted
    if (this.isTokenRevoked(token)) {
      throw new HttpException('Token has been revoked', HttpStatus.UNAUTHORIZED);
    }

    try {
      const decoded = decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        throw new HttpException('Invalid token format', HttpStatus.UNAUTHORIZED);
      }

      const client = await this.getJWKSClient();
      const key = await client.getSigningKey(decoded.header.kid);
      const publicKey = key.getPublicKey();

      const { userPoolId } = await this.getCognitoConfig();
      const region = this.getAWSConfig().region;

      const verified = verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
      }) as TokenPayload;

      return verified;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Token verification failed: ${err.message}`);
      
      if (err.name === 'TokenExpiredError') {
        throw new HttpException('Token has expired', HttpStatus.UNAUTHORIZED);
      }
      
      throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Decode JWT token without verification (use for non-critical operations)
   * @param token - JWT token to decode
   * @returns Decoded token payload
   * @throws {HttpException} If token format is invalid
   */
  decodeToken(token: string): TokenPayload {
    try {
      const decoded = decode(token) as TokenPayload;
      if (!decoded) {
        throw new HttpException('Invalid token format', HttpStatus.UNAUTHORIZED);
      }
      return decoded;
    } catch (error: unknown) {
      throw new HttpException('Failed to decode token', HttpStatus.UNAUTHORIZED);
    }
  }

  /**
   * Check if token is expired without verification
   * @param token - JWT token to check
   * @returns True if expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = decode(token) as TokenPayload;
      if (!decoded || !decoded.exp) return true;
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }

  /**
   * Revoke a token (add to blacklist)
   * @param token - Token to revoke
   */
  private async revokeToken(token: string): Promise<void> {
    const decoded = decode(token) as TokenPayload;
    if (!decoded || !decoded.exp) {
      throw new HttpException('Invalid token', HttpStatus.BAD_REQUEST);
    }

    this.tokenBlacklist.set(token, {
      expiresAt: decoded.exp * 1000,
      revokedAt: Date.now(),
    });

    this.logger.log(`Token revoked for user: ${this.sanitize(decoded.email || decoded.sub)}`);
  }

  /**
   * Check if token is blacklisted
   * @param token - Token to check
   * @returns True if revoked
   */
  private isTokenRevoked(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  /**
   * Cleanup expired tokens from blacklist
   */
  private cleanupBlacklist(): void {
    const now = Date.now();
    for (const [token, entry] of this.tokenBlacklist.entries()) {
      if (now > entry.expiresAt) {
        this.tokenBlacklist.delete(token);
      }
    }
  }

  // ============================================================================
  // AWS CONFIGURATION
  // ============================================================================

  /**
   * Get AWS SDK configuration
   * @returns AWS configuration object
   * @throws {InternalServerErrorException} If AWS_REGION is not set
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
   * @returns Cognito client instance
   */
  private getClient(): CognitoIdentityProviderClient {
    if (!this.cognitoClient) {
      this.cognitoClient = new CognitoIdentityProviderClient({
        region: this.getAWSConfig().region,
        requestHandler: new NodeHttpHandler({
          connectionTimeout: this.CONNECTION_TIMEOUT,
          socketTimeout: this.SOCKET_TIMEOUT,
        }),
        maxAttempts: this.MAX_RETRY_ATTEMPTS,
      });
      this.logger.log('Cognito client initialized');
    }
    return this.cognitoClient;
  }

  /**
   * Fetch Cognito configuration with caching
   * @returns Cognito configuration
   * @throws {InternalServerErrorException} If configuration is missing
   */
  private async getCognitoConfig() {
    const now = Date.now();

    // Serve from cache if valid
    if (this.configCache && now - this.configCacheTime < this.CONFIG_CACHE_TTL) {
      return this.configCache;
    }

    let userPoolId: string | undefined;
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    // --- Try to load from SecretsService ---
    if (this.secretService) {
      try {
        const poolId = await this.secretService.getSecret('cognito', 'user_pool_id');
        const clientIdFromSecret = await this.secretService.getSecret('cognito', 'client_id');
        const clientSecretFromSecret = await this.secretService.getSecret('cognito', 'client_secret');

        // ✅ Only use if both are non-empty valid values
        if (poolId && clientIdFromSecret) {
          userPoolId = poolId;
          clientId = clientIdFromSecret;
          clientSecret = clientSecretFromSecret;
        } else {
          this.logger.warn(
            '⚠️ Secret service returned incomplete or empty values — falling back to environment variables',
          );
        }
      } catch (error: any) {
        if (error.name === 'AccessDeniedException' || error.__type === 'AccessDeniedException') {
          this.logger.error(
            `🚫 Access denied while fetching from AWS SSM. Check IAM permissions for user or role.\nDetails: ${error.message}`,
          );
        } else if (error.name === 'ParameterNotFound') {
          this.logger.warn(`⚠️ One or more Cognito parameters not found in SSM: ${error.message}`);
        } else {
          this.logger.error(`❌ Failed to fetch secrets from secret service: ${error.message}`);
        }

        this.logger.warn('⚙️ Falling back to environment variables');
      }
    } else {
      this.logger.warn('⚙️ Secret service not found — using local environment variables');
    }

    // --- Fallback to ENV vars if missing ---
    if (!userPoolId) userPoolId = process.env.AWS_COGNITO_USER_POOL_ID;
    if (!clientId) clientId = process.env.AWS_COGNITO_CLIENT_ID;
    if (!clientSecret) clientSecret = process.env.AWS_COGNITO_CLIENT_SECRET;

    // --- Validate presence ---
    if (!userPoolId || !clientId) {
      throw new InternalServerErrorException(
        'AWS Cognito configuration missing. Set AWS_COGNITO_USER_POOL_ID and AWS_COGNITO_CLIENT_ID',
      );
    }

    // --- Cache result ---
    this.configCache = { userPoolId, clientId, clientSecret };
    this.configCacheTime = now;

    return this.configCache;
  }

  /**
   * Compute secret hash with caching
   * @param username - Username for hash computation
   * @returns Secret hash or undefined if no client secret
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

  // ============================================================================
  // EXECUTION WRAPPER
  // ============================================================================

  /**
   * Execute wrapper with error handling, metrics, and timing
   * @param operation - Async operation to execute
   * @param operationName - Name of operation for logging
   * @returns Operation result
   */
  private async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    this.metrics.requests++;
    const startTime = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      this.metrics.requestTimes.push(duration);
      
      // Keep only last 100 request times
      if (this.metrics.requestTimes.length > 100) {
        this.metrics.requestTimes.shift();
      }
      
      if (process.env.LOG_LEVEL === 'debug') {
        this.logger.debug(`${operationName} completed in ${duration}ms`);
      }
      
      return result;
    } catch (error: unknown) {
      this.metrics.errors++;
      const err = error as Error & { name?: string; code?: string };
      const errorName = err.name || 'UnknownError';
      
      this.metrics.errorsByType.set(
        errorName,
        (this.metrics.errorsByType.get(errorName) || 0) + 1,
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
        
        if (process.env.NODE_ENV === 'production') {
          delete (exception as any).stack;
        }
        throw exception;
      }

      // Unknown error - sanitized response
      const exception = new InternalServerErrorException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An unexpected error occurred',
        error: 'Internal Server Error',
        timestamp: new Date().toISOString(),
      });
      
      if (process.env.NODE_ENV === 'production') {
        delete (exception as any).stack;
      }
      throw exception;
    }
  }

  // ============================================================================
  // 🔐 AUTHENTICATION FLOW
  // ============================================================================

  /**
   * Sign up a new user
   * @param email - User's email address
   * @param password - User's password
   * @param attributes - Optional user attributes
   * @returns User registration result
   * @throws {HttpException} If validation fails or user exists
   * @example
   * ```typescript
   * const result = await cognito.signUp('user@example.com', 'Pass123!', {
   *   name: 'John Doe',
   *   phone_number: '+1234567890'
   * });
   * ```
   */
  async signUp(
    email: string,
    password: string,
    attributes?: Record<string, string>,
  ): Promise<SignUpResponse> {
    // Validation
    this.validateEmail(email);
    this.validateRequired(password, 'Password');

    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(email);

      const userAttributes = [{ Name: 'email', Value: email }];
      if (attributes) {
        const sanitized = this.sanitizeAttributes(attributes);
        userAttributes.push(
          ...Object.entries(sanitized).map(([Name, Value]) => ({ Name, Value })),
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
   * @param username - Username/email to confirm
   * @param code - 6-digit verification code
   * @returns Success confirmation
   * @throws {HttpException} If code is invalid or expired
   */
  async confirmSignUp(username: string, code: string) {
    this.validateEmail(username);
    this.validateCode(code);

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
   * @param username - Username to confirm
   * @returns Success confirmation
   */
  async adminConfirmSignUp(username: string) {
    this.validateRequired(username, 'Username');

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
   * User login
   * @param username - User's email/username
   * @param password - User's password
   * @returns JWT tokens or MFA/password challenge
   * @throws {HttpException} If credentials are invalid
   * @example
   * ```typescript
   * const result = await cognito.login('user@example.com', 'Pass123!');
   * if ('requiresMFA' in result) {
   *   // Handle MFA challenge
   * } else {
   *   // User logged in, use result.accessToken
   * }
   * ```
   */
  async login(
    username: string,
    password: string,
  ): Promise<LoginResponse | MFAChallengeResponse | NewPasswordRequiredResponse> {
    this.validateEmail(username);
    this.validateRequired(password, 'Password');

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
        } as MFAChallengeResponse;
      }

      // Handle new password required
      if (response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        this.logger.log(`New password required: ${this.sanitize(username)}`);
        return {
          requiresNewPassword: true,
          session: response.Session,
        } as NewPasswordRequiredResponse;
      }

      const auth = response.AuthenticationResult;
      this.logger.log(`User logged in: ${this.sanitize(username)}`);
      
      return {
        accessToken: auth.AccessToken,
        idToken: auth.IdToken,
        refreshToken: auth.RefreshToken,
        expiresIn: auth.ExpiresIn,
        tokenType: auth.TokenType,
      } as LoginResponse;
    }, 'login');
  }

  /**
   * Verify MFA code and complete login
   * @param username - Username
   * @param session - Session from MFA challenge
   * @param code - 6-digit MFA code
   * @param challengeName - Type of MFA challenge
   * @returns JWT tokens
   */
  async verifyMFA(
    username: string,
    session: string,
    code: string,
    challengeName: ChallengeNameType = ChallengeNameType.SOFTWARE_TOKEN_MFA,
  ): Promise<LoginResponse> {
    this.validateEmail(username);
    this.validateRequired(session, 'Session');
    this.validateCode(code);

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
   * @param refreshToken - Valid refresh token
   * @returns New access and ID tokens
   */
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    this.validateRequired(refreshToken, 'Refresh token');

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
   * Global sign out with token revocation
   * @param accessToken - Valid access token
   * @returns Success confirmation
   */
  async globalSignOut(accessToken: string): Promise<{ success: boolean; message: string }> {
    this.validateRequired(accessToken, 'Access token');

    // Add to blacklist before revoking
    await this.revokeToken(accessToken);

    return this.execute(async () => {
      const client = this.getClient();
      const command = new GlobalSignOutCommand({ AccessToken: accessToken });
      
      await client.send(command);
      this.logger.log('User signed out globally');
      
      return { success: true, message: 'Signed out successfully' };
    }, 'globalSignOut');
  }

  // ============================================================================
  // 🔑 PASSWORD MANAGEMENT
  // ============================================================================

  /**
   * Initiate forgot password flow
   * @param username - User's email/username
   * @returns Code delivery details
   */
  async forgotPassword(username: string) {
    this.validateEmail(username);

    return this.execute(async () => {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new ForgotPasswordCommand({
        ClientId: clientId,
        Username: username,
        ...(secretHash && { SecretHash: secretHash }),
      });

      const result = await client.send(command);
      this.logger.log(`Password reset initiated: ${this.sanitize(username)}`);
      
      return {
        codeDelivery: result.CodeDeliveryDetails,
        message: 'Password reset code sent',
      };
    }, 'forgotPassword');
  }

  /**
   * Confirm forgot password with code and new password
   * @param username - User's email/username
   * @param code - 6-digit verification code
   * @param newPassword - New password
   * @returns Success confirmation
   */
  async confirmForgotPassword(username: string, code: string, newPassword: string) {
    this.validateEmail(username);
    this.validateCode(code);
    this.validateRequired(newPassword, 'New password');

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
   * @param username - Username
   * @param newPassword - New password
   * @param permanent - Whether password is permanent
   * @returns Success confirmation
   */
  async setPassword(username: string, newPassword: string, permanent = true) {
    this.validateRequired(username, 'Username');
    this.validateRequired(newPassword, 'New password');

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

  // ============================================================================
  // 👤 USER MANAGEMENT
  // ============================================================================

  /**
   * Admin create user with temporary password
   * @param email - User's email
   * @param tempPassword - Temporary password
   * @param verified - Whether email is pre-verified
   * @param attributes - Optional user attributes
   * @returns Created user details
   */
  async adminCreateUser(
    email: string,
    tempPassword: string,
    verified = false,
    attributes?: Record<string, string>,
  ): Promise<UserDetails> {
    this.validateEmail(email);
    this.validateRequired(tempPassword, 'Temporary password');

    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const userAttributes = [{ Name: 'email', Value: email }];
      if (verified) userAttributes.push({ Name: 'email_verified', Value: 'true' });
      if (attributes) {
        const sanitized = this.sanitizeAttributes(attributes);
        userAttributes.push(
          ...Object.entries(sanitized).map(([Name, Value]) => ({ Name, Value })),
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
   * Get user details by username
   * @param username - Username to query
   * @returns User details
   */
  async getUser(username: string): Promise<UserDetails> {
    this.validateRequired(username, 'Username');

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
   * @param accessToken - Valid access token
   * @returns Current user details
   */
  async getCurrentUser(accessToken: string): Promise<{ username: string; attributes: Record<string, string> }> {
    this.validateRequired(accessToken, 'Access token');

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
   * @param username - Username
   * @param attributes - Attributes to update
   * @returns Success confirmation
   */
  async updateUserAttributes(username: string, attributes: Record<string, string>) {
    this.validateRequired(username, 'Username');
    
    if (!attributes || Object.keys(attributes).length === 0) {
      throw new HttpException('Attributes are required', HttpStatus.BAD_REQUEST);
    }

    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();
      const sanitized = this.sanitizeAttributes(attributes);

      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: username,
        UserAttributes: Object.entries(sanitized).map(([Name, Value]) => ({ Name, Value })),
      });

      await client.send(command);
      this.logger.log(`User attributes updated: ${this.sanitize(username)}`);
      
      return { success: true, message: 'User attributes updated' };
    }, 'updateUserAttributes');
  }

  /**
   * Delete user permanently
   * @param username - Username to delete
   * @returns Success confirmation
   */
  async deleteUser(username: string) {
    this.validateRequired(username, 'Username');

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
   * @param username - Username to disable
   * @returns Success confirmation
   */
  async disableUser(username: string) {
    this.validateRequired(username, 'Username');

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
   * @param username - Username to enable
   * @returns Success confirmation
   */
  async enableUser(username: string) {
    this.validateRequired(username, 'Username');

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
   * @param limit - Maximum number of users to return
   * @param paginationToken - Token for pagination
   * @param filter - Filter expression
   * @returns List of users and pagination token
   */
  async listUsers(limit = this.DEFAULT_USER_LIST_LIMIT, paginationToken?: string, filter?: string) {
    if (limit < 1 || limit > 60) {
      throw new HttpException('Limit must be between 1 and 60', HttpStatus.BAD_REQUEST);
    }

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

  // ============================================================================
  // 🔒 MFA MANAGEMENT
  // ============================================================================

  /**
   * Setup MFA - Get QR code secret
   * @param accessToken - Valid access token
   * @returns Secret code for QR generation
   */
  async setupMFA(accessToken: string) {
    this.validateRequired(accessToken, 'Access token');

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
   * @param accessToken - Valid access token
   * @param code - 6-digit TOTP code
   * @param friendlyDeviceName - Device name
   * @returns MFA confirmation status
   */
  async confirmMFA(accessToken: string, code: string, friendlyDeviceName = 'Primary Device') {
    this.validateRequired(accessToken, 'Access token');
    this.validateCode(code);

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

  // ============================================================================
  // 📊 MONITORING & HEALTH
  // ============================================================================

  /**
   * Get service metrics for monitoring
   * @returns Service metrics including error rates and timing
   */
  getMetrics() {
    const avgRequestTime = this.metrics.requestTimes.length > 0
      ? this.metrics.requestTimes.reduce((a, b) => a + b, 0) / this.metrics.requestTimes.length
      : 0;

    return {
      totalRequests: this.metrics.requests,
      totalErrors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 
        ? `${((this.metrics.errors / this.metrics.requests) * 100).toFixed(2)}%`
        : '0%',
      errorsByType: Object.fromEntries(this.metrics.errorsByType),
      lastError: this.metrics.lastError,
      averageRequestTime: `${avgRequestTime.toFixed(2)}ms`,
      cache: {
        configCached: !!this.configCache,
        secretHashCacheSize: this.secretHashCache.size,
        tokenBlacklistSize: this.tokenBlacklist.size,
      },
      client: {
        initialized: !!this.cognitoClient,
      },
      security: {
        revokedTokens: this.tokenBlacklist.size,
      },
    };
  }

  /**
   * Health check endpoint
   * @returns Health status
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
    } catch (error: unknown) {
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
    this.cleanupBlacklist();
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
      requestTimes: [],
    };
    this.logger.log('Metrics reset');
  }
}