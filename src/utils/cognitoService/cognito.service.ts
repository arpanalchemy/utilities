import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  UnauthorizedException,
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

    try {
      userPoolId = await this.secretService.getSecret('cognito', 'user_pool_id');
      clientId = await this.secretService.getSecret('cognito', 'client_id');
      clientSecret = await this.secretService.getSecret('cognito', 'client_secret');
    } catch (err) {
      this.logger.warn('⚠️ SecretsService unavailable, falling back to .env');
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
   * Centralized error handler for AWS Cognito exceptions
   */
  private handleCognitoError(error: any, context: string): never {
    const errorName = error.name || 'UnknownError';
    
    // Log the error concisely
    this.logger.error(`${context} failed: ${errorName} - ${error.message}`);

    // Map AWS errors to user-friendly messages
    const errorMap: Record<string, { message: string; exception: any }> = {
      CodeMismatchException: {
        message: 'Invalid verification code provided',
        exception: BadRequestException,
      },
      ExpiredCodeException: {
        message: 'Verification code has expired',
        exception: BadRequestException,
      },
      UserNotFoundException: {
        message: 'User not found',
        exception: BadRequestException,
      },
      NotAuthorizedException: {
        message: 'Invalid credentials or unauthorized access',
        exception: UnauthorizedException,
      },
      UsernameExistsException: {
        message: 'User already exists',
        exception: BadRequestException,
      },
      InvalidPasswordException: {
        message: 'Password does not meet security requirements',
        exception: BadRequestException,
      },
      InvalidParameterException: {
        message: 'Invalid parameters provided',
        exception: BadRequestException,
      },
      TooManyRequestsException: {
        message: 'Too many requests, please try again later',
        exception: BadRequestException,
      },
      UserNotConfirmedException: {
        message: 'User email not confirmed',
        exception: BadRequestException,
      },
      LimitExceededException: {
        message: 'Request limit exceeded',
        exception: BadRequestException,
      },
    };

    const errorConfig = errorMap[errorName];
    
    if (errorConfig) {
      throw new errorConfig.exception(errorConfig.message);
    }

    // Fallback for unknown errors
    throw new InternalServerErrorException(
      error.message || 'An unexpected error occurred',
    );
  }

  // ---------------------------------------------------------------------------
  // 🧩 AUTHENTICATION & USER MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * User Sign-Up (triggers email verification)
   */
  async signUp(email: string, password: string): Promise<any> {
    try {
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

      this.logger.log(`📩 Sign-up initiated for ${email}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Sign-up for ${email}`);
    }
  }

  /**
   * Confirm user email via code (from Cognito email)
   */
  async confirmSignUp(username: string, code: string): Promise<any> {
    try {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new ConfirmSignUpCommand({
        ClientId: clientId,
        Username: username,
        ConfirmationCode: code,
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      this.logger.log(`✅ Email confirmed for ${username}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Confirm sign-up for ${username}`);
    }
  }

  /**
   * Admin Confirm Sign-Up (bypass email verification)
   */
  async adminConfirmSignUp(username: string): Promise<any> {
    try {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminConfirmSignUpCommand({
        Username: username,
        UserPoolId: userPoolId,
      });

      this.logger.log(`🛠️ Admin confirmed signup for ${username}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Admin confirm sign-up for ${username}`);
    }
  }

  /**
   * Admin creates user with temporary password (optionally verified)
   */
  async adminCreateUser(email: string, tempPassword: string, verified = false): Promise<any> {
    try {
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

      this.logger.log(`👑 Admin created user ${email}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Admin create user ${email}`);
    }
  }

  /**
   * Admin sets permanent password
   */
  async setPassword(username: string, newPassword: string): Promise<any> {
    try {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminSetUserPasswordCommand({
        Username: username,
        Password: newPassword,
        UserPoolId: userPoolId,
        Permanent: true,
      });

      this.logger.log(`🔐 Permanent password set for ${username}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Set password for ${username}`);
    }
  }

  /**
   * Login with username/password — supports MFA
   */
  async adminLogin(username: string, password: string): Promise<any> {
    try {
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
        this.logger.warn(`⚠️ MFA required for ${username}`);
        return { challenge: response.ChallengeName, session: response.Session };
      }

      this.logger.log(`✅ ${username} logged in`);
      return response.AuthenticationResult;
    } catch (error) {
      this.handleCognitoError(error, `Login for ${username}`);
    }
  }

  /**
   * Verify MFA Challenge
   */
  async verifyMFA(username: string, session: string, code: string): Promise<any> {
    try {
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

      this.logger.log(`🔑 MFA verified for ${username}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Verify MFA for ${username}`);
    }
  }

  /**
   * Generate TOTP MFA secret (to show as QR)
   */
  async setupMFA(accessToken: string): Promise<any> {
    try {
      const client = this.getClient();
      const command = new AssociateSoftwareTokenCommand({ AccessToken: accessToken });
      const response = await client.send(command);
      this.logger.log(`📲 MFA secret generated`);
      return response;
    } catch (error) {
      this.handleCognitoError(error, 'Setup MFA');
    }
  }

  /**
   * Confirm MFA setup using code from authenticator app
   */
  async confirmMFA(accessToken: string, code: string): Promise<any> {
    try {
      const client = this.getClient();
      const command = new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: code,
        FriendlyDeviceName: 'Primary Device',
      });

      const response = await client.send(command);
      this.logger.log(`✅ MFA setup confirmed`);
      return response;
    } catch (error) {
      this.handleCognitoError(error, 'Confirm MFA setup');
    }
  }

  // ---------------------------------------------------------------------------
  // 🔁 TOKEN MANAGEMENT
  // ---------------------------------------------------------------------------

  async refreshToken(refreshToken: string): Promise<any> {
    try {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: { REFRESH_TOKEN: refreshToken },
      });

      this.logger.log(`♻️ Refresh token used`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, 'Refresh token');
    }
  }

  // ---------------------------------------------------------------------------
  // 🔧 USER MAINTENANCE
  // ---------------------------------------------------------------------------

  async forgotPassword(username: string): Promise<any> {
    try {
      const { clientId } = await this.getCognitoConfig();
      const client = this.getClient();
      const secretHash = await this.computeSecretHash(username);

      const command = new ForgotPasswordCommand({
        ClientId: clientId,
        Username: username,
        ...(secretHash ? { SecretHash: secretHash } : {}),
      });

      this.logger.log(`🧩 Forgot password initiated for ${username}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Forgot password for ${username}`);
    }
  }

  async confirmForgotPassword(username: string, code: string, newPassword: string): Promise<any> {
    try {
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

      this.logger.log(`🔁 Password reset confirmed for ${username}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Confirm forgot password for ${username}`);
    }
  }

  async updateUserAttributes(username: string, attributes: Record<string, string>): Promise<any> {
    try {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminUpdateUserAttributesCommand({
        UserPoolId: userPoolId,
        Username: username,
        UserAttributes: Object.entries(attributes).map(([Name, Value]) => ({ Name, Value })),
      });

      this.logger.log(`✏️ Attributes updated for ${username}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Update attributes for ${username}`);
    }
  }

  async getUser(username: string): Promise<any> {
    try {
      const { userPoolId } = await this.getCognitoConfig();
      const client = this.getClient();

      const command = new AdminGetUserCommand({
        UserPoolId: userPoolId,
        Username: username,
      });

      this.logger.log(`👤 Retrieved user ${username}`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, `Get user ${username}`);
    }
  }

  async globalSignOut(accessToken: string): Promise<any> {
    try {
      const client = this.getClient();
      const command = new GlobalSignOutCommand({ AccessToken: accessToken });
      this.logger.log(`🚪 Global sign-out`);
      return client.send(command);
    } catch (error) {
      this.handleCognitoError(error, 'Global sign-out');
    }
  }
}