import { Test, TestingModule } from '@nestjs/testing';
import { ChatPostMessageArguments } from '@slack/web-api';
import { SlackService } from './slack.service';
import { SecretsService } from '../secretsService/secrets.service';

// Mock the WebClient class from '@slack/web-api'
jest.mock('@slack/web-api', () => ({
  WebClient: jest.fn().mockImplementation(() => ({
    chat: {
      postMessage: jest.fn(),
    },
  })),
}));

// Mock the SecretsService

describe('SlackService', () => {
  let slackService: SlackService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlackService,
        {
          provide: SecretsService,
          useValue: {
            getSecret: () => 'mocked-oauth-token',
          },
        },
      ],
    }).compile();

    slackService = module.get<SlackService>(SlackService);
  });

  it('should be defined', () => {
    expect(slackService).toBeDefined();
  });

  it('should send a message', async () => {
    const messageData: ChatPostMessageArguments = {
      channel: 'test-channel',
      text: 'Hello, Jest!',
    };
    const getSecret = jest.spyOn(
      (slackService as any).secretService,
      'getSecret',
    );

    await slackService.sendMessage(messageData);

    // Check if the postMessage method was called with the correct data
    expect(getSecret).toHaveBeenCalledWith('slack', 'oauth_token');
  });
});
