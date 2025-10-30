import { Injectable } from "@nestjs/common";

@Injectable()
export class SecretsService {
  async getSecret(namespace: string, key: string): Promise<string> {
    switch (namespace + "_" + key) {
      case "redis_url":
        return SecretServiceMockHelper.getRedisURL();
      default:
        return "test";
    }
  }
}

export class SecretServiceMockHelper {
  private static exceptionMode = false;
  static setExceptionMode(mode: boolean = true) {
    this.exceptionMode = mode;
  }
  static getRedisURL() {
    if (this.exceptionMode) return "";
    return `test-redi-cache.com`;
  }
}
