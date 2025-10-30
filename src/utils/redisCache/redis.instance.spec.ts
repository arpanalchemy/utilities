import { RedisInstance } from "./redis.instance";
import { Test } from "@nestjs/testing";
import { RedisHelper } from "./redis.helpers";
import { RedisClientType } from "@redis/client";
import { config } from "dotenv";
import { SecretsService as SecretsServiceMock } from "../__mocks__/secrets.service";
import { SecretsService } from "../secretsService/secrets.service";
import { createClient } from "../../__mocks__/redis";

config();
describe(`Redis Instance Injectable for Env: ${process.env.CLUSTER_ENV}`, () => {
  let instance: RedisInstance;
  let redisMock: RedisClientType;
  let secretMock: SecretsService;
  beforeAll(async () => {
    jest.mock("redis", () => jest.requireActual("../__mocks__/redis"));

    //jest.mock('../utils/secrets.service',()=>jest.requireActual('../utils/__mocks__/secrets.service'))
    const moduleRef = await Test.createTestingModule({
      providers: [
        RedisInstance,
        { provide: SecretsService, useClass: SecretsServiceMock },
      ],
    }).compile();
    instance = moduleRef.get<RedisInstance>(RedisInstance);
    secretMock = new SecretsServiceMock() as SecretsService;
    redisMock = createClient(
      (await RedisHelper.getConnString(secretMock)) as any
    );
    redisMock.on("error", () => null);
    redisMock.on("connect", () => null);
    await redisMock.connect();
  });

  it("Check First Connection", async () => {
    const onConnected = jest.spyOn(instance as any, "onConnected");
    expect(Object.keys(await instance.getClient()).sort()).toEqual(
      Object.keys(redisMock).sort()
    );
    await new Promise((r) => setTimeout(r, 100));
    expect(onConnected).toHaveBeenCalled();
  });

  it("Check connection Exist and client object is not null", async () => {
    expect((instance as any).client).not.toBeNull();
    expect((instance as any).connection).toBe(true);
  });

  it("Second Attempt to check instance is a singleton class", async () => {
    expect(Object.keys(await instance.getClient()).sort()).toEqual(
      Object.keys(redisMock).sort()
    );
  });

  it("Check if error exists", async () => {
    const onError = jest.spyOn(instance as any, "onError");
    (instance as any).connection = false;
    (instance as any).connErr = "Test Conn Error";
    expect(instance.getClient()).rejects.not.toBeNull();
  });

  it("Check if connection chenge when on error is called", async () => {
    await (instance as any).getClient();
    const quit = jest.spyOn((instance as any).client, "quit");
    (instance as any).onError("Sample Error");
    await new Promise((r) => setTimeout(r, 100));
    expect((instance as any).connection).toBe(false);
    expect((instance as any).connErr).toBe("Sample Error");
    expect(quit).toHaveBeenCalled();
  });

  afterAll(async () => {
    try {
      (await instance.getClient()).quit();
    } catch (e) {}

    redisMock.quit();
  });
});
