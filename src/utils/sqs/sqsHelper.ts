import { Inject, Injectable } from '@nestjs/common';
import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SQSClient,
} from '@aws-sdk/client-sqs';
import { EventBridge } from '@aws-sdk/client-eventbridge';
import { SecretsService } from '../secretsService/secrets.service';
import { DateUtils } from '../date/dateUtils.service';

export class SQSDTO<S> {
  queue?: string;
  type?: string;
  subType?: string;
  data: S;
}

@Injectable()
export class SqsHelper {
  @Inject(SecretsService)
  private readonly secrets: SecretsService;
  private sqsClient: SQSClient;
  private eventBridge: EventBridge;

  constructor() {
    this.sqsClient = new SQSClient(this.getAWSConfig());
    this.eventBridge = new EventBridge(this.getAWSConfig());
  }

  /**
   * Sends a message to an SQS queue.
   * @param params - The message parameters.
   * @param delay - The delay in seconds before the message is available for processing.
   * @param queueUrl - The URL of the SQS queue to send the message to.
   * dafault queue is background_task_queue or put the name of queus as
   * env variable named SERVICE_QUEUE_NAME or pass queue url drectly
   * @param options - Additional options for sending the message.
   * @returns A promise that resolves to the result of sending the message.
   */

  async sendMessage<S>(
    params: SQSDTO<S>,
    delay = 0,
    queueUrl?: string,
    options: any = {},
  ): Promise<any> {
    const sqsBackgroundTaskQueue = await this.secrets.getSecret(
      'sqs',
      process.env.SERVICE_QUEUE_NAME || 'background_task_queue',
    );

    const command = new SendMessageCommand({
      DelaySeconds: delay,
      MessageBody: JSON.stringify({
        ...params,
        environment: process.env.ENVIRONMENT_ALIAS,
      }),
      QueueUrl: queueUrl || process.env.SQS_QUEUE_URL || sqsBackgroundTaskQueue,
      ...options,
    });

    return this.sqsClient.send(command);
  }

  private getAWSConfig() {
    return {
      region: process.env.AWS_REGION,
    };
  }

  async getQueueMessages<T>(
    queueUrl: string,
    deleteMessage: boolean = true,
  ): Promise<T[]> {
    let messages: T[] = [];
    let receiveParams = {
      QueueUrl: queueUrl,
      MaxNumberOfMessages: 10,
      VisibilityTimeout: 20,
      WaitTimeSeconds: 0,
    };

    while (true) {
      const receiveCommand = new ReceiveMessageCommand(receiveParams);
      const response = await this.sqsClient.send(receiveCommand);

      if (!response.Messages || response.Messages.length === 0) {
        break;
      }

      messages.push(
        ...response.Messages.map((message) => JSON.parse(message.Body)),
      );

      if (deleteMessage)
        for (const message of response.Messages) {
          const deleteParams = {
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle!,
          };
          const deleteCommand = new DeleteMessageCommand(deleteParams);
          await this.sqsClient.send(deleteCommand);
        }
    }

    return messages;
  }

  async scheduleSQS(
    name: string,
    scheduledDate: string | Date,
    dataToSend: any,
    arnPath: string = 'arn',
  ): Promise<unknown> {
    if (!name || !scheduledDate) {
      throw new Error(`missing param:${name ? 'name' : 'scheduleDate'}`);
    }
    dataToSend['shouldDeleteEventBridgeRule'] = true;
    const Name = `rule_for_${name}`;
    const cron = DateUtils.getTimeInCronFormat(scheduledDate);
    const ScheduleExpression = `cron(${cron.mn} ${cron.hh} ${cron.dd} ${cron.mm} ? ${cron.yy})`;
    const sqsArn = await this.secrets.getSecret('sqs', arnPath);
    await new Promise((resolve, reject) => {
      this.eventBridge.putRule(
        {
          Name,
          ScheduleExpression,
        },
        function (err, data) {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        },
      );
    });
    return new Promise((resolve, reject) => {
      this.eventBridge.putTargets(
        {
          Rule: Name,
          Targets: [
            {
              Arn: sqsArn,
              Id: 'background-dl-queue',
              Input: JSON.stringify(dataToSend),
            },
          ],
        },
        function (err, data) {
          if (err) {
            console.log(err);
            reject(err);
          } else {
            resolve(data);
          }
        },
      );
    });
  }

  /**
   * Deletes an EventBridge rule and its associated targets.
   * @param name - The name of the rule to delete.
   */
  async deleteEventBridgeRule(name: string): Promise<any> {
    const ruleName = `rule_for_${name}`;

    // Try-catch to handle errors gracefully
    try {
      // First remove targets associated with the rule
      const removeTargetsResponse = await this.removeEventBridgeTargets(
        ruleName,
      );

      if (removeTargetsResponse === 'ResourceNotFoundException') {
        return true;
      }

      // Then delete the rule
      return new Promise((resolve, reject) => {
        this.eventBridge.deleteRule(
          {
            Name: ruleName,
            Force: true, // Ensure to force delete even if there are associated targets
          },
          (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          },
        );
      });
    } catch (error) {
      console.error('Error deleting EventBridge rule:', error);
    }
  }

  /**
   * Removes targets associated with an EventBridge rule.
   * @param ruleName - The name of the rule for which to remove the targets.
   */
  async removeEventBridgeTargets(ruleName: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.eventBridge.removeTargets(
        {
          Rule: ruleName,
          Ids: ['background-dl-queue'], // The target IDs to remove
        },
        (err, data) => {
          if (err && err.name === 'ResourceNotFoundException') {
            resolve('ResourceNotFoundException');
          } else if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        },
      );
    });
  }
}
