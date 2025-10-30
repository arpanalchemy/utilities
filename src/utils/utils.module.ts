import { Module } from "@nestjs/common";
import { CryptoService } from "../utils/crypto/crypto.service";
import { RedisInstance } from "./redisCache/redis.instance";
import { SecretsService } from "../utils/secretsService/secrets.service";
import { SqsHelper } from "../utils/sqs/sqsHelper";
import { URLService } from "../utils/urlService/url.service";
import { AxiosHelper } from "./axiosCall/axios.helper";
import { RedisUtilHelper } from "./redisCache/redis.util.helper";
import { CommonUtil } from "../utils/commonUtilService/common.util.service";
import { S3Service } from "../utils/s3Service/s3.service";
import { DateCalculationUtil } from "./dateCalculation/dateCalculation.util.service";
import { RedisGenericHelper } from "./redisCache/redis.generic.helper";
import { RazorpayHelper } from "./razorpay/razorpay.helper";

@Module({
  providers: [
    SecretsService,
    RedisInstance,
    S3Service,
    URLService,
    CommonUtil,
    AxiosHelper,
    SqsHelper,
    CryptoService,
    RedisUtilHelper,
    DateCalculationUtil,
    RedisGenericHelper,
    RazorpayHelper,
  ],
  exports: [
    SecretsService,
    RedisInstance,
    S3Service,
    URLService,
    CommonUtil,
    AxiosHelper,
    SqsHelper,
    CryptoService,
    RedisUtilHelper,
    DateCalculationUtil,
    RedisGenericHelper,
    RazorpayHelper,
  ],
})
export class UtilsModule {}
