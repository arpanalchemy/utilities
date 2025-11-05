import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  NotFoundException,
  ConflictException,
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

/**
 * All-in-One Cognito Service with built-in clean error handling
 * No external filters or configuration needed - just import and use!
 */
@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);

  constructor(private secretService?: SecretsService) {}

  /**
   * AWS SDK Client configuration
   */
  private getAWSConfig() {
    const region = process.env.AWS_REGION;
    if (!region) {
      throw new InternalServerErrorException('AWS_REGION is not set');
    }
    return { region };
  }

  /**
   * Fetch Cognito credentials (from Secrets Manager if available, else .env)
   */
  private async getCognitoConfig() {
    let userPoolId: string | undefined;
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    if (this.secretService) {
      try {
        userPoolId = await this.secretService.getSecret('cognito', 'user_pool_id');
        clientId = await this.secretService.getSecret('cognito', 'client_id');
        clientSecret = await this.secretService.getSecret('cognito', 'client_secret');
      } catch (err) {
        // Silent fallback to env vars
      }
    }

    userPoolId = userPoolId || process.env.AWS_COGNITO_USER_POOL_ID;
    clientId = clientId || process.env.AWS_COGNITO_CLIENT_ID;
    clientSecret = clientSecret || process.env.AWS_COGNITO_CLIENT_SECRET;

    if (!userPoolId || !clientId) {
      throw new InternalServerErrorException('Cognito configuration missing');
    }

    return { userPoolId, clientId, clientSecret };
  }

  /**
   * Returns a new Cognito Identity Provider client
   */
  private getClient() {
    return new CognitoIdentityProviderClient(this.getAWSConfig());
  }

  /**
   * Computes Cognito secret hash (for apps with client_secret)
   */
  private async computeSecretHash(username: string): Promise<string | undefined> {
    const { clientId, clientSecret } = await this.getCognitoConfig();
    if (!clientSecret) return undefined;
    const hmac = createHmac('sha256', clientSecret);
    hmac.update(username + clientId);
    return hmac.digest('base64');
  }

  /**
   * Sanitize email for logging (masks personal info)
   */
  private sanitize(email: string): string {
    if (!email || !email.includes('@')) return '***';
    const [local, domain] = email.split('@');
    return `${local.charAt(0)}***@${domain}`;
  }

  /**
   * 🔥 THE MAGIC METHOD - Wraps ALL Cognito calls with clean error handling
   * This eliminates the need for external filters or try-catch blocks
   */
  private async execute<T>(
    operation: () => Promise<T>,
    operationName: string,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      const errorName = error.name || 'UnknownError';

      // Single-line error log (no stack trace)
      this.logger.error(`${operationName} failed: ${errorName}`);

      // Map AWS errors to clean HTTP exceptions
      const errorMap: Record<string, { exception: any; message: string }> = {
        CodeMismatchException: {
          exception: BadRequestException,
          message: 'Invalid verification code provided',
        },
        ExpiredCodeException: {
          exception: BadRequestException,
          message: 'Verification code has expired, please request a new one',
        },
        UserNotFoundException: {
          exception: NotFoundException,
          message: 'User not found',
        },
        NotAuthorizedException: {
          exception: UnauthorizedException,
          message: 'Invalid credentials or unauthorized access',
        },
        UsernameExistsException: {
          exception: ConflictException,
          message: 'User already exists',
        },
        InvalidPasswordException: {
          exception: BadRequestException,
          message: 'Password does not meet security requirements',
        },
        InvalidParameterException: {
          exception: BadRequestException,
          message: 'Invalid parameters provided',
        },
        TooManyRequestsException: {
          exception: HttpException,
          message: 'Too many requests, please try again later',
        },
        UserNotConfirmedException: {
          exception: BadRequestException,
          message: 'Please verify your email before logging in',
        },
        LimitExceededException: {
          exception: HttpException,
          message: 'Request limit exceeded',
        },
        TooManyFailedAttemptsException: {
          exception: HttpException,
          message: 'Too many failed attempts, account temporarily locked',
        },
      };

      const errorConfig = errorMap[errorName];

      if (errorConfig) {
        // Throw clean exception with user-friendly message
        if (errorConfig.exception === HttpException) {
          throw new HttpException(errorConfig.message, HttpStatus.TOO_MANY_REQUESTS);
        }
        throw new errorConfig.exception(errorConfig.message);
      }

      // Unknown error - hide internal details
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  // ===========================================================================
  // 🧩 AUTHENTICATION & USER MANAGEMENT
  // ===========================================================================

  /**
   * User Sign-Up (triggers email verification)
   */
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
      this.logger.log(`Sign-up initiated for ${this.sanitize(email)}`);
      return result;
    }, 'Sign-up');
  }

  /**
   * Confirm user email via code
   */
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
      this.logger.log(`Email confirmed for ${this.sanitize(username)}`);
      return result;
    }, 'Confirm sign-up');
  }

  /**
   * Admin Confirm Sign-Up (bypass email verification)
   */
  async adminConfirmSignUp(username: string): Promise<any> {
    return this.execute(async () => {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminConfirmSignUpCommand({
        Username: username,
        UserPoolId: userPoolId,
      });

      const result = await client.send(command);
      this.logger.log(`Admin confirmed ${this.sanitize(username)}`);
      return result;
    }, 'Admin confirm sign-up');
  }

  /**
   * Admin creates user with temporary password
   */
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
      this.logger.log(`Admin created user ${this.sanitize(email)}`);
      return result;
    }, 'Admin create user');
  }

  /**
   * Admin sets permanent password
   */
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
      this.logger.log(`Password set for ${this.sanitize(username)}`);
      return result;
    }, 'Set password');
  }

  /**
   * Login with username/password (supports MFA)
   */
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
        this.logger.log(`MFA required for ${this.sanitize(username)}`);
        return { challenge: response.ChallengeName, session: response.Session };
      }

      this.logger.log(`Login successful for ${this.sanitize(username)}`);
      return response.AuthenticationResult;
    }, 'Login');
  }

  /**
   * Verify MFA Challenge
   */
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
      this.logger.log(`MFA verified for ${this.sanitize(username)}`);
      return result;
    }, 'Verify MFA');
  }

  /**
   * Setup MFA - Generate TOTP secret
   */
  async setupMFA(accessToken: string): Promise<any> {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new AssociateSoftwareTokenCommand({ AccessToken: accessToken });
      const result = await client.send(command);
      this.logger.log('MFA secret generated');
      return result;
    }, 'Setup MFA');
  }

  /**
   * Confirm MFA setup with verification code
   */
  async confirmMFA(accessToken: string, code: string): Promise<any> {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: code,
        FriendlyDeviceName: 'Primary Device',
      });

      const result = await client.send(command);
      this.logger.log('MFA setup confirmed');
      return result;
    }, 'Confirm MFA');
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
    }, 'Refresh token');
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
      this.logger.log(`Password reset initiated for ${this.sanitize(username)}`);
      return result;
    }, 'Forgot password');
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
      this.logger.log(`Password reset confirmed for ${this.sanitize(username)}`);
      return result;
    }, 'Confirm forgot password');
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
      this.logger.log(`Attributes updated for ${this.sanitize(username)}`);
      return result;
    }, 'Update user attributes');
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
      this.logger.log(`Retrieved user ${this.sanitize(username)}`);
      return result;
    }, 'Get user');
  }

  async globalSignOut(accessToken: string): Promise<any> {
    return this.execute(async () => {
      const client = this.getClient();
      const command = new GlobalSignOutCommand({ AccessToken: accessToken });
      const result = await client.send(command);
      this.logger.log('Global sign-out');
      return result;
    }, 'Global sign-out');
  }
}