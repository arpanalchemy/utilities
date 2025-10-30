## @alchemy/utilities

A collection of NestJS-friendly utilities and helpers used across Alchemy services. It bundles common integrations (AWS S3/SQS/EventBridge/Textract), HTTP helpers, Redis caching helpers, logging/interceptors, decorators, and misc utility services.

### Install

```bash
npm install @alchemy/utilities
```

Requires Node 16+, NestJS 8+, and TypeScript.

### Build & Test

```bash
# build (outputs to dist/)
npm run build

# run tests
npm test

# coverage
npm run test:cov
```

### Usage (NestJS)

Most classes are Nest providers. Import `UtilsModule` to make commonly used providers available for DI.

```ts
import { Module } from '@nestjs/common';
import { UtilsModule, S3Service, AxiosHelper } from '@alchemy/utilities';

@Module({
  imports: [UtilsModule],
  providers: [],
})
export class AppModule {}

// Inject where needed
export class FilesService {
  constructor(
    private readonly s3: S3Service,
    private readonly http: AxiosHelper,
  ) {}
}
```

You can also import individual exports directly from the package entry.

### Environment Variables

Set these env vars in your service (or supply via your secrets provider):

- **AWS_REGION**: AWS region for S3/SQS/EventBridge/Textract
- **BASE_URL**: Base URL used by `URLService.generateURL`
- **ENVIRONMENT_ALIAS**: Environment tag appended in SQS messages
- Optionally service-specific values like `SQS_QUEUE_URL`, `SERVICE_QUEUE_NAME`

Secrets are resolved via `SecretsService` keys below:

- `('s3', 'documents_bucket')`: Target S3 bucket for documents
- `('auth', 'encryption_key')`: Secret used by `ResponseHashInterceptor`
- `('sqs', <arnPath>)`: EventBridge target ARN for scheduled SQS

### Exports (selected)

From `src/index.ts` the package exports:

- Utilities/Services: `S3Service`, `SecretsService`, `SqsHelper`, `URLService`, `CommonUtil`, `AxiosHelper`, `CryptoService`, `RedisInstance`, `RedisUtilHelper`, `RedisGenericHelper`, `DateCalculationUtil`, `DateUtils`, `TimeUtils`
- External Integrations: `RazorpayHelper` (+ `razorpay.dto`), `MoengageEvents`, `Whatsapp` and `Email` helpers/DTOs, `SlackService`, `ZohoHelper`, `GcEventWebhookHelper`, `DmfWebhookHelper`
- Interceptors: `RequestLoggerInterceptor`, `RequestCacheInterceptor`, `ResponseHashInterceptor`, `NewrelicInterceptor`, `TransactionInterceptor`
- Decorators: `@Public`, `@Request`, `@TransactionParams`, `HandleError` utilities, `CacheTrack` decorator
- Module: `UtilsModule`

Refer to types for exact method signatures.

### Key Modules

- URLService (`utils/urlService/url.service`)

  - Build query strings: `createQuery`, `createQueryFilter`, `createCompleteQuery`, `createOrderByFilter`
  - Helpers: `generateURL(resource)`, `apiTimeout()`, `stringify(obj)`

- AxiosHelper (`utils/axiosCall/axios.helper`)

  - Thin axios wrapper with structured logging and timeouts
  - Methods: `getData`, `postData`, `putData`, `patchData`, `deleteData`, `headData`
  - Accepts optional configs; logs errors via Winston

- S3Service (`utils/s3Service/s3.service`)

  - `downloadFromS3`, `upload`, `uploadToS3`, `deleteObjectS3`, `copyFilesInS3`
  - `generatePresignedS3Url`, `generateUploadUrl`
  - `extractText(key)`: Reads first page (PDF supported) and analyzes via Textract

- SqsHelper (`utils/sqs/sqsHelper`)

  - `sendMessage(params, delay?, queueUrl?, options?)`
  - `getQueueMessages(queueUrl, deleteMessage?)`
  - Scheduling via EventBridge: `scheduleSQS(name, date, data, arnPath?)`, `deleteEventBridgeRule(name)`

- Redis Utilities

  - `RedisInstance`: creates and returns a Redis client
  - `RedisUtilHelper`: `setCacheValue`, `getCountFromRedis`, `resetCacheValue`
  - `RedisGenericHelper`: common JSON get/set helpers (see file)

- CryptoService (`utils/crypto/crypto.service`)
  - Hashing helpers including `generateHashWithSalt` (used by response hashing)

### Interceptors

- RequestLoggerInterceptor

  - Logs inbound request and outbound response/error via `RequestLoggerHelper` (Winston)

- ResponseHashInterceptor

  - For non-GET requests, computes a hash of the response body using `CryptoService` and secret `('auth','encryption_key')`
  - Sets response header `x-response-token`

- RequestCacheInterceptor
  - Scaffold for request-level caching with `ttl` constructor arg (extend to plug a cache store)

### Decorators

- HandleError

  - Wraps method execution; converts axios errors into `HttpException`
  - Options: `{ status?, message?, supress? }`

- CacheTrack(cacheKey)

  - Adds a New Relic custom attribute `cache_<cacheKey>` with hit/miss based on returned value

- Public, Request, TransactionParams
  - Common request/route metadata helpers for NestJS apps

### Logging

Most helpers/interceptors inject the Nest-Winston logger via `WINSTON_MODULE_PROVIDER`. Ensure your app configures `nest-winston`.

```ts
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

WinstonModule.forRoot({
  transports: [new winston.transports.Console()],
});
```

### Example: Using AxiosHelper + URLService

```ts
import { AxiosHelper, URLService } from '@alchemy/utilities';

export class ExampleService {
  constructor(
    private readonly http: AxiosHelper,
    private readonly url: URLService,
  ) {}

  async fetchUsers(filters: any) {
    const url =
      this.url.generateURL('users') +
      this.url.createCompleteQuery({ filter: filters });
    return this.http.getData(url);
  }
}
```

### Development

- TypeScript config: `tsconfig.json` / `tsconfig.build.json`
- Release: `npm run release` (CI-only guard via `release-script`)

### License

ISC
