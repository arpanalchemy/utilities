import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Test } from "@nestjs/testing";
import { WINSTON_MODULE_PROVIDER } from "nest-winston";
import { SecretsService } from "./secrets.service";
import { GetParameterCommand } from "../../__mocks__/@aws-sdk/client-ssm";

describe("Testcases for Secrets Service", () => {
  let module: SecretsService;
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SecretsService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            set: () => jest.fn(),
            get: () => "test",
            store: {
              keys: {
                test1: [],
              },
            },
          },
        },
        {
          provide: WINSTON_MODULE_PROVIDER,
          useValue: {
            debug: () => jest.fn(),
            error: () => jest.fn(),
            warn: () => jest.fn(),
            log: () => jest.fn(),
          },
        },
      ],
    }).compile();
    module = moduleRef.get<SecretsService>(SecretsService);
  });

  it("Should Run load secret", async () => {
    process.env.CLUSTER_ENV = "test_env";
    const ssm = jest
      .spyOn((module as any).SSM, "send")
      .mockResolvedValue({ Parameter: { Value: "test_val" } });
    const cacheManager = jest
      .spyOn((module as any).cacheManager, "set")
      .mockResolvedValue(null);

    expect(await module.loadSecret("test_set", "test_key")).toBe("test_val");
    expect(ssm).toHaveBeenCalledTimes(1);
    expect(GetParameterCommand).toHaveBeenCalledWith({
      Name: `/test_set/test_env/test_key`,
      WithDecryption: false,
    });
    expect(cacheManager).toHaveBeenCalledWith("test_set_test_key", "test_val");
  });

  it("Should Run load secret with different env", async () => {
    process.env.CLUSTER_ENV = "test_prod";
    const ssm = jest
      .spyOn((module as any).SSM, "send")
      .mockResolvedValue({ Parameter: { Value: "test_val_2" } });
    const cacheManager = jest
      .spyOn((module as any).cacheManager, "set")
      .mockResolvedValue(null);

    expect(await module.loadSecret("test_set_2", "test_key_2")).toBe(
      "test_val_2"
    );
    expect(ssm).toHaveBeenCalledTimes(1);
    expect(GetParameterCommand).toHaveBeenCalledWith({
      Name: `/test_set_2/test_prod/test_key_2`,
      WithDecryption: false,
    });
    expect(cacheManager).toHaveBeenCalledWith(
      "test_set_2_test_key_2",
      "test_val_2"
    );
  });

  // Note: getAWSConfig method doesn't exist in SecretsService
  // This test has been removed as it's not applicable

  it("Should return Error load Secrets", async () => {
    const error = jest.spyOn((module as any).logger, "error");
    expect(await module.loadSecret("test", "test")).toBe(null);
    expect(error).toHaveBeenCalled();
  });

  it("Should return secret value when fetched", async () => {
    const cacheManagerMock = jest
      .spyOn((module as any).cacheManager, "get")
      .mockImplementationOnce(() => {
        return "test";
      });
    expect(await module.getSecret("XXXX", "test")).toBe("test");
    expect(cacheManagerMock).toHaveBeenCalledWith("XXXX_test");
  });

  it("Should fetch return secret value when not available in cache", async () => {
    const cacheManagerMock = jest
      .spyOn((module as any).cacheManager, "get")
      .mockImplementationOnce(() => {
        return null;
      });
    const loadSecretSpy = jest
      .spyOn(module, "loadSecret")
      .mockResolvedValue("test");
    expect(await module.getSecret("testSet", "test")).toBe("test");
    expect(loadSecretSpy).toHaveBeenCalledWith("testSet", "test");
    expect(cacheManagerMock).toHaveBeenCalledWith("testSet_test");
  });
});
