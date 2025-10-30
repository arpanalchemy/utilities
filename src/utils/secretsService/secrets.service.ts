import * as dotenv from 'dotenv';
dotenv.config();
import { Inject, CACHE_MANAGER, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

@Injectable()
export class SecretsService {
  constructor(
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,

    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  // Global AWS Secrets Manager instance

  private readonly SSM = new SSMClient(this.getAWSConfig());

  private getAWSConfig() {
    return {
      region: process.env.AWS_REGION,
    };
  }

  /*
   * Load a secret from AWS Secrets Manager
   * @param namespace
   * @param key
   * Example: loadSecret('database', 'password')
   */
  async loadSecret(namespace: string, key: string): Promise<string> {
    let value =
      process.env[`${namespace.toUpperCase()}_${key.toUpperCase()}`] || null;
    try {
      const command = new GetParameterCommand({
        Name: `/${namespace}/${process.env.CLUSTER_ENV}/${key}`,
        WithDecryption: false,
      });
      const data = await this.SSM.send(command);
      value = data.Parameter.Value;
      this.logger.debug('Secret Loaded For ' + namespace + ' - ' + key);
    } catch (err) {
      this.logger.error(err);
    }
    await this.cacheManager.set(`${namespace}_${key}`, value);
    return value;
  }

  /**
   *
   * Publically exposed method to get a specific secret value
   *
   */
  async getSecret(namespace: string, key: string): Promise<string> {
    let value = await this.cacheManager.get(`${namespace}_${key}`);
    if (!value) {
      value = await this.loadSecret(namespace, key);
    }
    return String(value);
  }
}
