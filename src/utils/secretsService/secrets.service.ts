import * as dotenv from 'dotenv';
dotenv.config();
import { Inject, CACHE_MANAGER, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

@Injectable()
export class SecretsService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  // Global AWS SSM client
  private readonly SSM = new SSMClient({ region: process.env.AWS_REGION });

  private buildPath(namespace: string, key: string): string {
    const clusterEnv = process.env.CLUSTER_ENV || 'dev';
    return `/${namespace}/${clusterEnv}/${key}`;
  }

  /**
   * Load a secret from AWS SSM (with ENV fallback)
   */
  async loadSecret(namespace: string, key: string): Promise<string | null> {
    let value: string | null =
      process.env[`${namespace.toUpperCase()}_${key.toUpperCase()}`] ?? null;
    const paramPath = this.buildPath(namespace, key);

    try {
      const command = new GetParameterCommand({
        Name: paramPath,
        WithDecryption: false,
      });
      const data = await this.SSM.send(command);

      if (data.Parameter?.Value) {
        value = data.Parameter.Value;
        this.logger.debug(`✅ Secret loaded from SSM: ${paramPath}`);
      } else {
        this.logger.warn(`⚠️ Empty secret from SSM: ${paramPath}`);
      }
    } catch (err: any) {
      if (err.name === 'AccessDeniedException') {
        this.logger.error(
          `🚫 AccessDeniedException: Not authorized to read ${paramPath}. Check IAM policy for ssm:GetParameter.`,
        );
      } else if (err.name === 'ParameterNotFound') {
        this.logger.warn(`⚠️ Parameter not found in SSM: ${paramPath}`);
      } else {
        this.logger.error(`❌ Failed to load secret ${paramPath}: ${err.message}`);
      }

      // If SSM fails, fallback to ENV
      if (!value) {
        const envKey = `${namespace.toUpperCase()}_${key.toUpperCase()}`;
        const envValue = process.env[envKey];
        if (envValue && envValue !== 'undefined' && envValue !== 'null' && envValue !== '') {
          value = envValue;
          this.logger.debug(`🔁 Loaded ${paramPath} from ENV fallback`);
        } else {
          this.logger.warn(`⚠️ No fallback ENV value found for ${envKey}`);
        }
      }
    }

    // Normalize bad values
    if (
      value === undefined ||
      value === null ||
      value === 'undefined' ||
      value === 'null' ||
      value === ''
    ) {
      value = null;
    }

    await this.cacheManager.set(`${namespace}_${key}`, value);
    return value;
  }

  /**
   * Public method to get a secret (cached)
   */
  async getSecret(namespace: string, key: string): Promise<string> {
    let value = await this.cacheManager.get<string | null>(`${namespace}_${key}`);

    if (!value) {
      value = await this.loadSecret(namespace, key);
    }

    // Clean invalid placeholders
    if (
      value === undefined ||
      value === null ||
      value === 'undefined' ||
      value === 'null' ||
      value === ''
    ) {
      value = null;
    }

    // Return as string for backward compatibility
    return String(value ?? '');
  }
}
