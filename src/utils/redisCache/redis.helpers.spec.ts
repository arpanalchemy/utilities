import { SecretsService } from "../secretsService/secrets.service";
import {
  SecretsService as SecretsServiceMock,
  SecretServiceMockHelper,
} from "../__mocks__/secrets.service";
import { RedisHelper } from "./redis.helpers";
import { config } from "dotenv";

config();

describe("Running Test for Redis Helper to Get URL", () => {
  let secretMock: SecretsService;
  let envName = process.env.CLUSTER_ENV;
  const errString = "Redis Connection Attempt Failed";
  beforeAll(() => {
    secretMock = new SecretsServiceMock() as any as SecretsService;
  });

  it("Should Return localhost string", async () => {
    process.env.CLUSTER_ENV = "test";
    process.env.REDIS_ENV = "local";
    const returnObj = {
      url: "redis://localhost:6379",
      socket: {
        reconnectStrategy: () => new Error(errString),
      },
    };
    expect(JSON.stringify(await RedisHelper.getConnString(secretMock))).toEqual(
      JSON.stringify(returnObj)
    );
    expect(await RedisHelper.getConnString(secretMock)).toHaveProperty(
      "socket.reconnectStrategy"
    );
  });

  it("Should Return Dev string", async () => {
    process.env.CLUSTER_ENV = "dev";
    const returnObj = {
      url: "redis://test-redi-cache.com",
      socket: {
        reconnectStrategy: () => new Error(errString),
      },
    };
    expect(JSON.stringify(await RedisHelper.getConnString(secretMock))).toEqual(
      JSON.stringify(returnObj)
    );
    expect(await RedisHelper.getConnString(secretMock)).toHaveProperty(
      "socket.reconnectStrategy"
    );
  });

  it("Should Throw an error if no value returned from secret", async () => {
    SecretServiceMockHelper.setExceptionMode();
    await expect(RedisHelper.getConnString(secretMock)).rejects.toThrow(
      `Couldn't fetch connection string from Secrets`,
    );
  });

  it("Should Have the thown an Error when Called reconnectStrategy", () => {
    expect(RedisHelper.reconnectStrategy()().message).toEqual(errString);
  });
  afterAll(() => {
    SecretServiceMockHelper.setExceptionMode(false);
    process.env.CLUSTER_ENV = envName;
  });
});
