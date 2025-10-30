import { createClient } from "redis";
import { Inject, Injectable } from "@nestjs/common";
import { RedisHelper } from "./redis.helpers";
import { SecretsService } from "../secretsService/secrets.service";
import {
  RedisClientType,
  RedisFunctions,
  RedisModules,
  RedisScripts,
} from "@redis/client";

/**
 *
 * @summary This is a singleton class that creates an injectable instance of redis. Redis instance can be obtained by using getClient() method
 */
@Injectable()
export class RedisInstance {
  private client: RedisClientType<RedisModules, RedisFunctions, RedisScripts>;

  private connection: boolean = false;
  private connErr: string;

  constructor(@Inject(SecretsService) private secretService: SecretsService) {}

  /**
   *
   * @summary onError Callback that sets the connection false and throws error during failure
   */
  private async onError(err: string) {
    this.connErr = err;
    this.connection = false;
    await this.client.quit();
  }

  /**
   *
   * @summary onConnected sets the connection parameter to true that determines getClient to return client object
   */
  private onConnected() {
    this.connection = true;
  }

  /**
   *
   * @summary This method sets redis connection
   */
  private async connect(): Promise<void> {
    this.client = createClient(
      await RedisHelper.getConnString(this.secretService)
    );
    this.client.on("error", this.onError.bind(this));
    this.client.on("connect", this.onConnected.bind(this));
    await this.client.connect();
  }

  /**
   *
   * @summary The only public method that will create connection and will return the previous instance if it exists
   */
  async getClient(): Promise<
    RedisClientType<RedisModules, RedisFunctions, RedisScripts>
  > {
    if (!this.client) {
      await this.connect();
    }
    if (!this.connection) {
      this.client = null;
      throw new Error(`Error Connecting Redis ${this.connErr}`);
    }
    return this.client;
  }
}
