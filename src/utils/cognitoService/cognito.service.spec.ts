import { Test, TestingModule } from '@nestjs/testing';
import { CognitoService } from './cognito.service';
import { SecretsService } from '../secretsService/secrets.service';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
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

// Mock Cognito client send() method
const mockSend = jest.fn();

jest.mock('@aws-sdk/client-cognito-identity-provider', () => {
  const original = jest.requireActual('@aws-sdk/client-cognito-identity-provider');
  return {
    ...original,
    CognitoIdentityProviderClient: jest.fn(() => ({
      send: mockSend,
    })),
  };
});

describe('CognitoService', () => {
  let service: CognitoService;
  let secretService: SecretsService;

  beforeEach(async () => {
    mockSend.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CognitoService,
        {
          provide: SecretsService,
          useValue: {
            getSecret: jest.fn((namespace, key) => {
              const secrets = {
                user_pool_id: 'us-east-1_ExamplePool',
                client_id: 'exampleClientId',
                client_secret: 'exampleSecret',
              };
              return secrets[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CognitoService>(CognitoService);
    secretService = module.get<SecretsService>(SecretsService);

    process.env.AWS_REGION = 'us-east-1';
  });

  // -----------------------------------------------------
  // 🧩 CONFIGURATION TESTS
  // -----------------------------------------------------
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw error if AWS_REGION not set', () => {
    delete process.env.AWS_REGION;
    expect(() => (service as any).getAWSConfig()).toThrow();
  });

  it('should return AWS config with region', () => {
    const config = (service as any).getAWSConfig();
    expect(config).toEqual({ region: 'us-east-1' });
  });

  // -----------------------------------------------------
  // 🔐 SIGN UP / LOGIN
  // -----------------------------------------------------
  it('should call SignUpCommand with correct params', async () => {
    mockSend.mockResolvedValue({
      UserSub: 'user-123',
      UserConfirmed: false,
      CodeDeliveryDetails: undefined,
    });

    const response = await service.signUp('test@example.com', 'Pass@123');
    expect(mockSend).toHaveBeenCalledWith(expect.any(SignUpCommand));
    expect(response).toEqual({
      userId: 'user-123',
      confirmed: false,
      codeDelivery: undefined,
    });
  });

  it('should call AdminConfirmSignUpCommand', async () => {
    mockSend.mockResolvedValue({});

    const response = await service.adminConfirmSignUp('test@example.com');
    expect(mockSend).toHaveBeenCalledWith(
      expect.any(AdminConfirmSignUpCommand),
    );
    expect(response).toEqual({
      success: true,
      message: 'User confirmed by admin',
    });
  });

  it('should call AdminCreateUserCommand', async () => {
    mockSend.mockResolvedValue({ User: { Username: 'test@example.com', UserStatus: 'FORCE_CHANGE_PASSWORD', Enabled: true, UserCreateDate: new Date() } });
    const response = await service.adminCreateUser('test@example.com', 'Temp@123', true);
    expect(mockSend).toHaveBeenCalledWith(expect.any(AdminCreateUserCommand));
    expect(response.username).toEqual('test@example.com');
  });

  it('should call AdminSetUserPasswordCommand', async () => {
    mockSend.mockResolvedValue({ Success: true });
    await service.setPassword('test@example.com', 'New@123');
    expect(mockSend).toHaveBeenCalledWith(expect.any(AdminSetUserPasswordCommand));
  });

  it('should call login', async () => {
    mockSend.mockResolvedValue({ AuthenticationResult: { AccessToken: 'token', IdToken: 'id', RefreshToken: 'refresh', ExpiresIn: 3600, TokenType: 'Bearer' } });
    const res = await service.login('test@example.com', 'Pass@123');
    expect(mockSend).toHaveBeenCalledWith(expect.any(AdminInitiateAuthCommand));
    if ('accessToken' in res) {
      expect(res.accessToken).toBe('token');
    } else {
      fail('Expected LoginResponse but got different type');
    }
  });
  

  // -----------------------------------------------------
  // 🔑 MFA FLOW
  // -----------------------------------------------------
  it('should handle MFA challenge in login', async () => {
    mockSend.mockResolvedValue({ ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: 'session123' });
    const res = await service.login('test@example.com', 'Pass@123');
    expect(res).toEqual({ requiresMFA: true, challenge: 'SOFTWARE_TOKEN_MFA', session: 'session123' });
  });

  it('should verify MFA challenge', async () => {
    mockSend.mockResolvedValue({ AuthenticationResult: { AccessToken: 'token' } });
    await service.verifyMFA('test@example.com', 'session123', '123456');
    expect(mockSend).toHaveBeenCalledWith(expect.any(RespondToAuthChallengeCommand));
  });

  it('should setup MFA', async () => {
    mockSend.mockResolvedValue({ SecretCode: 'ABC123' });
    await service.setupMFA('accessToken');
    expect(mockSend).toHaveBeenCalledWith(expect.any(AssociateSoftwareTokenCommand));
  });

  it('should confirm MFA', async () => {
    mockSend.mockResolvedValue({ Status: 'SUCCESS' });
    await service.confirmMFA('accessToken', '123456');
    expect(mockSend).toHaveBeenCalledWith(expect.any(VerifySoftwareTokenCommand));
  });

  // -----------------------------------------------------
  // 🔁 TOKEN & PASSWORD MANAGEMENT
  // -----------------------------------------------------
  it('should refresh token', async () => {
    mockSend.mockResolvedValue({ AuthenticationResult: { AccessToken: 'newAccessToken', IdToken: 'id', RefreshToken: 'refresh', ExpiresIn: 3600, TokenType: 'Bearer' } });
    const result = await service.refreshToken('refreshToken');
    expect(mockSend).toHaveBeenCalledWith(expect.any(InitiateAuthCommand));
    expect(result.accessToken).toBe('newAccessToken');
  });

  it('should handle forgot password flow', async () => {
    mockSend.mockResolvedValue({ CodeDeliveryDetails: { Destination: 'email' } });
    const res = await service.forgotPassword('test@example.com');
    expect(mockSend).toHaveBeenCalledWith(expect.any(ForgotPasswordCommand));
    expect(res.codeDelivery.Destination).toBe('email');
  });

  it('should confirm forgot password', async () => {
    mockSend.mockResolvedValue({ Status: 'OK' });
    await service.confirmForgotPassword('test@example.com', '123456', 'NewPass@123');
    expect(mockSend).toHaveBeenCalledWith(expect.any(ConfirmForgotPasswordCommand));
  });

  // -----------------------------------------------------
  // 👤 USER MANAGEMENT
  // -----------------------------------------------------
  it('should update user attributes', async () => {
    mockSend.mockResolvedValue({ Status: 'UPDATED' });
    await service.updateUserAttributes('test@example.com', { name: 'Viral' });
    expect(mockSend).toHaveBeenCalledWith(expect.any(AdminUpdateUserAttributesCommand));
  });

  it('should get user details', async () => {
    mockSend.mockResolvedValue({ Username: 'test@example.com', UserStatus: 'CONFIRMED', Enabled: true, UserCreateDate: new Date(), UserLastModifiedDate: new Date() });
    const res = await service.getUser('test@example.com');
    expect(mockSend).toHaveBeenCalledWith(expect.any(AdminGetUserCommand));
    expect(res.username).toBe('test@example.com');
  });

  it('should global sign out user', async () => {
    mockSend.mockResolvedValue({ Success: true });
    await service.globalSignOut('accessToken');
    expect(mockSend).toHaveBeenCalledWith(expect.any(GlobalSignOutCommand));
  });
});
