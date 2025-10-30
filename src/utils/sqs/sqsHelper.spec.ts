import { Test, TestingModule } from '@nestjs/testing';
import { SQSClient } from '@aws-sdk/client-sqs';
import { SqsHelper } from './sqsHelper';
import { SecretsService } from '../secretsService/secrets.service';
import { EventBridge } from '@aws-sdk/client-eventbridge';

const secretsServiceMock = {
  getSecret: jest.fn(),
};

jest.mock('../secretsService/secrets.service', () => {
  return {
    SecretsService: jest.fn(() => secretsServiceMock),
  };
});

describe('SqsHelper', () => {
  let sqsHelper: SqsHelper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SqsHelper,
        {
          provide: SQSClient,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: SecretsService,
          useValue: secretsServiceMock,
        },
        {
          provide: EventBridge,
          useValue: {
            putRule: jest.fn(),
            putTargets: jest.fn(),
            deleteRule: jest.fn(),
            removeTargets: jest.fn(),
          },
        },
      ],
    }).compile();

    sqsHelper = module.get<SqsHelper>(SqsHelper);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ENVIRONMENT_ALIAS;
    delete process.env.SERVICE_QUEUE_NAME;
    delete process.env.SQS_QUEUE_URL;
    delete process.env.AWS_REGION;
  });

  it('should be defined', () => {
    expect(sqsHelper).toBeDefined();
  });

  it('should send a message with default parameters', async () => {
    jest.spyOn((sqsHelper as any).sqsClient, 'send').mockResolvedValue({});
    const params = { data: 'test' };

    const result = await sqsHelper.sendMessage(params);
    expect(result).toBeDefined();
  });

  it('should include environment variable in message body when ENVIRONMENT_ALIAS is set', async () => {
    process.env.ENVIRONMENT_ALIAS = 'test-environment';
    let capturedParams: any;
    
    // Spy on SendMessageCommand constructor to capture parameters
    const SendMessageCommandSpy = jest.spyOn(require("@aws-sdk/client-sqs"), "SendMessageCommand").mockImplementation(function(params) {
      capturedParams = params;
      return { input: params };
    });
    
    const mockSend = jest.spyOn((sqsHelper as any).sqsClient, "send").mockResolvedValue({});
    jest.spyOn(secretsServiceMock, "getSecret").mockResolvedValue("test-queue-url");
    
    const params = { data: 'test' };
    await sqsHelper.sendMessage(params);

    expect(JSON.parse(capturedParams.MessageBody)).toEqual({
      ...params,
      environment: 'test-environment',
    });
    
    SendMessageCommandSpy.mockRestore();
  });

  it('should include undefined environment when ENVIRONMENT_ALIAS is not set', async () => {
    let capturedParams: any;
    
    const SendMessageCommandSpy = jest.spyOn(require("@aws-sdk/client-sqs"), "SendMessageCommand").mockImplementation(function(params) {
      capturedParams = params;
      return { input: params };
    });
    
    const mockSend = jest.spyOn((sqsHelper as any).sqsClient, "send").mockResolvedValue({});
    jest.spyOn(secretsServiceMock, "getSecret").mockResolvedValue("test-queue-url");
    
    const params = { data: 'test' };
    await sqsHelper.sendMessage(params);

    expect(JSON.parse(capturedParams.MessageBody)).toEqual({
      ...params,
      environment: undefined,
    });
    
    SendMessageCommandSpy.mockRestore();
  });

  it('should use SERVICE_QUEUE_NAME when provided', async () => {
    process.env.SERVICE_QUEUE_NAME = 'custom-service-queue';
    let capturedParams: any;
    
    const SendMessageCommandSpy = jest.spyOn(require("@aws-sdk/client-sqs"), "SendMessageCommand").mockImplementation(function(params) {
      capturedParams = params;
      return { input: params };
    });
    
    const mockSend = jest.spyOn((sqsHelper as any).sqsClient, "send").mockResolvedValue({});
    jest.spyOn(secretsServiceMock, "getSecret").mockResolvedValue("custom-queue-url");
    
    const params = { data: 'test' };
    await sqsHelper.sendMessage(params);

    expect(secretsServiceMock.getSecret).toHaveBeenCalledWith("sqs", "custom-service-queue");
    expect(capturedParams.QueueUrl).toBe("custom-queue-url");
    
    SendMessageCommandSpy.mockRestore();
  });

  it('should fallback to background_task_queue when SERVICE_QUEUE_NAME is not set', async () => {
    let capturedParams: any;
    
    const SendMessageCommandSpy = jest.spyOn(require("@aws-sdk/client-sqs"), "SendMessageCommand").mockImplementation(function(params) {
      capturedParams = params;
      return { input: params };
    });
    
    const mockSend = jest.spyOn((sqsHelper as any).sqsClient, "send").mockResolvedValue({});
    jest.spyOn(secretsServiceMock, "getSecret").mockResolvedValue("background-queue-url");
    
    const params = { data: 'test' };
    await sqsHelper.sendMessage(params);

    expect(secretsServiceMock.getSecret).toHaveBeenCalledWith("sqs", "background_task_queue");
    expect(capturedParams.QueueUrl).toBe("background-queue-url");
    
    SendMessageCommandSpy.mockRestore();
  });

  it('should use SQS_QUEUE_URL when provided and no queueUrl parameter', async () => {
    process.env.SQS_QUEUE_URL = 'env-queue-url';
    let capturedParams: any;
    
    const SendMessageCommandSpy = jest.spyOn(require("@aws-sdk/client-sqs"), "SendMessageCommand").mockImplementation(function(params) {
      capturedParams = params;
      return { input: params };
    });
    
    const mockSend = jest.spyOn((sqsHelper as any).sqsClient, "send").mockResolvedValue({});
    jest.spyOn(secretsServiceMock, "getSecret").mockResolvedValue("secret-queue-url");
    
    const params = { data: 'test' };
    await sqsHelper.sendMessage(params);

    expect(capturedParams.QueueUrl).toBe("env-queue-url");
    
    SendMessageCommandSpy.mockRestore();
  });

  it('should prioritize queueUrl parameter over environment variables', async () => {
    process.env.SQS_QUEUE_URL = 'env-queue-url';
    process.env.SERVICE_QUEUE_NAME = 'custom-service-queue';
    let capturedParams: any;
    
    const SendMessageCommandSpy = jest.spyOn(require("@aws-sdk/client-sqs"), "SendMessageCommand").mockImplementation(function(params) {
      capturedParams = params;
      return { input: params };
    });
    
    const mockSend = jest.spyOn((sqsHelper as any).sqsClient, "send").mockResolvedValue({});
    
    const params = { data: 'test' };
    const customQueueUrl = 'custom-queue-url';
    await sqsHelper.sendMessage(params, 0, customQueueUrl);

    expect(capturedParams.QueueUrl).toBe(customQueueUrl);
    
    SendMessageCommandSpy.mockRestore();
  });

  it('should apply delay seconds to the message', async () => {
    let capturedParams: any;
    
    const SendMessageCommandSpy = jest.spyOn(require("@aws-sdk/client-sqs"), "SendMessageCommand").mockImplementation(function(params) {
      capturedParams = params;
      return { input: params };
    });
    
    const mockSend = jest.spyOn((sqsHelper as any).sqsClient, "send").mockResolvedValue({});
    jest.spyOn(secretsServiceMock, "getSecret").mockResolvedValue("test-queue-url");
    
    const params = { data: 'test' };
    const delay = 30;
    await sqsHelper.sendMessage(params, delay);

    expect(capturedParams.DelaySeconds).toBe(delay);
    
    SendMessageCommandSpy.mockRestore();
  });

  it('should apply additional options to the send command', async () => {
    let capturedParams: any;
    
    const SendMessageCommandSpy = jest.spyOn(require("@aws-sdk/client-sqs"), "SendMessageCommand").mockImplementation(function(params) {
      capturedParams = params;
      return { input: params };
    });
    
    const mockSend = jest.spyOn((sqsHelper as any).sqsClient, "send").mockResolvedValue({});
    jest.spyOn(secretsServiceMock, "getSecret").mockResolvedValue("test-queue-url");
    
    const params = { data: 'test' };
    const options = { 
      MessageGroupId: 'test-group',
      MessageDeduplicationId: 'test-dedup' 
    };
    await sqsHelper.sendMessage(params, 0, undefined, options);

    expect(capturedParams.MessageGroupId).toBe('test-group');
    expect(capturedParams.MessageDeduplicationId).toBe('test-dedup');
    
    SendMessageCommandSpy.mockRestore();
  });

  it('should receive and delete messages from the queue', async () => {
    const queueUrl = 'test-queue-url';
    const messages = [
      { Body: JSON.stringify({ data: 'message1' }), ReceiptHandle: 'handle1' },
      { Body: JSON.stringify({ data: 'message2' }), ReceiptHandle: 'handle2' },
    ];

    jest
      .spyOn((sqsHelper as any).sqsClient, 'send')
      .mockImplementationOnce(() => Promise.resolve({ Messages: messages }))
      .mockImplementationOnce(() => Promise.resolve({}))
      .mockImplementationOnce(() => Promise.resolve({}))
      .mockImplementationOnce(() => Promise.resolve({ Messages: [] }));

    const result = await sqsHelper.getQueueMessages(queueUrl);

    expect(result).toEqual([{ data: 'message1' }, { data: 'message2' }]);
    expect((sqsHelper as any).sqsClient.send).toHaveBeenCalledTimes(4);
  });

  it('should receive messages from the queue without deleting', async () => {
    const queueUrl = 'test-queue-url';
    const messages = [
      { Body: JSON.stringify({ data: 'message1' }), ReceiptHandle: 'handle1' },
      { Body: JSON.stringify({ data: 'message2' }), ReceiptHandle: 'handle2' },
    ];

    jest
      .spyOn((sqsHelper as any).sqsClient, 'send')
      .mockImplementationOnce(() => Promise.resolve({ Messages: messages }))
      .mockImplementationOnce(() => Promise.resolve({ Messages: [] }));

    const result = await sqsHelper.getQueueMessages(queueUrl, false);

    expect(result).toEqual([{ data: 'message1' }, { data: 'message2' }]);
    expect((sqsHelper as any).sqsClient.send).toHaveBeenCalledTimes(2);
  });

  it('should send a message with custom parameters', async () => {
    jest.spyOn((sqsHelper as any).sqsClient, 'send').mockResolvedValue({});
    const params = { data: 'test' };
    const queueUrl = 'test-queue-url';
    const options = { MessageGroupId: 'test-group-id' };

    const result = await sqsHelper.sendMessage(params, 0, queueUrl, options);
    expect(result).toBeDefined();
  });

  it('should schedule an SQS message', async () => {
    jest.spyOn(secretsServiceMock, 'getSecret').mockResolvedValue('test-arn');

    const putRuleMock = jest
      .spyOn((sqsHelper as any).eventBridge, 'putRule')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(null, {
            RuleArn: 'arn:aws:events:region:account:rule/test-schedule',
          });
        },
      );

    const putTargetsMock = jest
      .spyOn((sqsHelper as any).eventBridge, 'putTargets')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(null, {});
        },
      );

    const name = 'test-schedule';
    const scheduledDate = new Date();
    const dataToSend = { key: 'value' };
    const arnPath = 'arn:test';

    const result = await sqsHelper.scheduleSQS(
      name,
      scheduledDate,
      dataToSend,
      arnPath,
    );

    expect(result).toBeDefined();
    expect(secretsServiceMock.getSecret).toHaveBeenCalledWith('sqs', arnPath);

    expect(putRuleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Name: `rule_for_${name}`,
        ScheduleExpression: expect.stringMatching(
          /^cron\(\d{1,2} \d{1,2} \d{1,2} \d{1,2} \? \d{4}\)$/,
        ),
      }),
      expect.any(Function),
    );

    expect(putTargetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Rule: `rule_for_${name}`,
        Targets: [
          {
            Arn: 'test-arn',
            Id: 'background-dl-queue',
            Input: JSON.stringify({
              ...dataToSend,
              shouldDeleteEventBridgeRule: true,
            }),
          },
        ],
      }),
      expect.any(Function),
    );
  });

  it('should throw error when scheduling SQS with missing name', async () => {
    const scheduledDate = new Date();
    const dataToSend = { key: 'value' };

    await expect(
      sqsHelper.scheduleSQS('', scheduledDate, dataToSend),
    ).rejects.toThrow('missing param:scheduleDate');
  });

  it('should throw error when scheduling SQS with missing scheduledDate', async () => {
    const name = 'test-schedule';
    const dataToSend = { key: 'value' };

    await expect(sqsHelper.scheduleSQS(name, '', dataToSend)).rejects.toThrow(
      'missing param:name',
    );
  });

  it('should use default arn path when not provided', async () => {
    jest.spyOn(secretsServiceMock, 'getSecret').mockResolvedValue('test-arn');

    jest
      .spyOn((sqsHelper as any).eventBridge, 'putRule')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(null, {
            RuleArn: 'arn:aws:events:region:account:rule/test-schedule',
          });
        },
      );

    jest
      .spyOn((sqsHelper as any).eventBridge, 'putTargets')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(null, {});
        },
      );

    const name = 'test-schedule';
    const scheduledDate = new Date();
    const dataToSend = { key: 'value' };

    await sqsHelper.scheduleSQS(name, scheduledDate, dataToSend);

    expect(secretsServiceMock.getSecret).toHaveBeenCalledWith('sqs', 'arn');
  });

  it('should delete an EventBridge rule and its associated targets', async () => {
    const ruleName = 'test-rule';
    const deleteRuleMock = jest
      .spyOn((sqsHelper as any).eventBridge, 'deleteRule')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(null, {});
        },
      );

    const removeTargetsMock = jest
      .spyOn((sqsHelper as any).eventBridge, 'removeTargets')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(null, {});
        },
      );

    const result = await sqsHelper.deleteEventBridgeRule(ruleName);

    expect(result).toBeDefined();
    expect(removeTargetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Rule: `rule_for_${ruleName}`,
        Ids: ['background-dl-queue'],
      }),
      expect.any(Function),
    );

    expect(deleteRuleMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Name: `rule_for_${ruleName}`,
        Force: true,
      }),
      expect.any(Function),
    );
  });

  it('should handle ResourceNotFoundException when removing targets', async () => {
    const ruleName = 'test-rule';
    const deleteRuleMock = jest
      .spyOn((sqsHelper as any).eventBridge, 'deleteRule')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(null, {});
        },
      );

    const removeTargetsMock = jest
      .spyOn((sqsHelper as any).eventBridge, 'removeTargets')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          const error = new Error('ResourceNotFoundException');
          (error as any).name = 'ResourceNotFoundException';
          callback(error, null);
        },
      );

    const result = await sqsHelper.deleteEventBridgeRule(ruleName);

    expect(result).toBe(true);
    expect(removeTargetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Rule: `rule_for_${ruleName}`,
        Ids: ['background-dl-queue'],
      }),
      expect.any(Function),
    );

    expect(deleteRuleMock).not.toHaveBeenCalled();
  });

  it('should handle errors when deleting EventBridge rule', async () => {
    const ruleName = 'test-rule';
    const errorMessage = 'Error deleting rule';

    jest
      .spyOn((sqsHelper as any).eventBridge, 'removeTargets')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(null, {});
        },
      );

    jest
      .spyOn((sqsHelper as any).eventBridge, 'deleteRule')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(new Error(errorMessage), null);
        },
      );

    await expect(sqsHelper.deleteEventBridgeRule(ruleName)).rejects.toThrow(
      errorMessage,
    );
  });

  it('should remove targets associated with an EventBridge rule', async () => {
    const ruleName = 'test-rule';
    const removeTargetsMock = jest
      .spyOn((sqsHelper as any).eventBridge, 'removeTargets')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(null, {});
        },
      );

    const result = await sqsHelper.removeEventBridgeTargets(ruleName);

    expect(result).toBeDefined();
    expect(removeTargetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Rule: ruleName,
        Ids: ['background-dl-queue'],
      }),
      expect.any(Function),
    );
  });

  it('should handle ResourceNotFoundException when removing targets', async () => {
    const ruleName = 'test-rule';
    const removeTargetsMock = jest
      .spyOn((sqsHelper as any).eventBridge, 'removeTargets')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          const error = new Error('ResourceNotFoundException');
          (error as any).name = 'ResourceNotFoundException';
          callback(error, null);
        },
      );

    const result = await sqsHelper.removeEventBridgeTargets(ruleName);

    expect(result).toBe('ResourceNotFoundException');
    expect(removeTargetsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Rule: ruleName,
        Ids: ['background-dl-queue'],
      }),
      expect.any(Function),
    );
  });

  it('should handle errors when removing targets', async () => {
    const ruleName = 'test-rule';
    const errorMessage = 'Error removing targets';

    jest
      .spyOn((sqsHelper as any).eventBridge, 'removeTargets')
      .mockImplementation(
        (params: any, callback: (err: any, data: any) => void) => {
          callback(new Error(errorMessage), null);
        },
      );

    await expect(sqsHelper.removeEventBridgeTargets(ruleName)).rejects.toThrow(
      errorMessage,
    );
  });

  describe('AWS Config', () => {
    it('should use AWS_REGION environment variable for AWS config', () => {
      process.env.AWS_REGION = 'us-west-2';

      // Create a new instance to test the constructor
      const newSqsHelper = new SqsHelper();
      const awsConfig = (newSqsHelper as any).getAWSConfig();

      expect(awsConfig).toEqual({
        region: 'us-west-2',
      });
    });

    it('should handle undefined AWS_REGION', () => {
      delete process.env.AWS_REGION;

      const newSqsHelper = new SqsHelper();
      const awsConfig = (newSqsHelper as any).getAWSConfig();

      expect(awsConfig).toEqual({
        region: undefined,
      });
    });
  });
});
