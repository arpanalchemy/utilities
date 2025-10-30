import { LOCAL_CONN_STRING } from "./redis.constants";
import { RedisClientOptions } from "redis";
import { SecretsService } from "../secretsService/secrets.service";

export class RedisHelper {
  static async getConnString(
    secret: SecretsService
  ): Promise<RedisClientOptions> {
    if (process.env.CLUSTER_ENV === "test" && process.env.REDIS_ENV === "local")
      return {
        url: LOCAL_CONN_STRING,
        socket: {
          reconnectStrategy: this.reconnectStrategy(),
        },
      };

    const url = process.env.REDIS_URL ?? await secret.getSecret("redis", "url");
    if (!url) throw new Error(`Couldn't fetch connection string from Secrets`);
    return {
      url: `redis://${url}`,
      socket: {
        reconnectStrategy: this.reconnectStrategy(),
      },
    };
  }

  static reconnectStrategy(): () => Error {
    return () => new Error("Redis Connection Attempt Failed");
  }
}
