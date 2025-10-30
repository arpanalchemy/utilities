import { Inject, Injectable } from '@nestjs/common';
import { PresignedPost, createPresignedPost } from '@aws-sdk/s3-presigned-post';
import {
  CopyObjectCommand,
  CopyObjectCommandOutput,
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  DeleteObjectCommandOutput,
  GetObjectCommand,
  PutObjectCommand,
  PutObjectCommandOutput,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  TextractClient,
  AnalyzeDocumentCommand,
} from '@aws-sdk/client-textract';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StreamingBlobPayloadOutputTypes } from '@smithy/types';
import { SecretsService } from '../secretsService/secrets.service';
import { extractFirstPage } from '../../generic-utils/object/object';

@Injectable()
export class S3Service {
  @Inject()
  private readonly secretService: SecretsService;
  private s3Path = `https://s3.ap-south-1.amazonaws.com/`;
  private getAWSConfig() {
    return {
      region: process.env.AWS_REGION,
    };
  }

  async downloadFromS3(params: any): Promise<StreamingBlobPayloadOutputTypes> {
    const client = new S3Client(this.getAWSConfig());
    const command = new GetObjectCommand(params);
    const response = await client.send(command);
    return response.Body;
  }

  /**
   * Delete an object from S3
   */
  deleteObjectS3(
    params: DeleteObjectCommandInput,
  ): Promise<DeleteObjectCommandOutput> {
    const client = new S3Client(this.getAWSConfig());
    const command = new DeleteObjectCommand(params);
    return client.send(command);
  }

  async generatePresignedS3Url(key: string, expiry = 120): Promise<string> {
    const bucket = await this.secretService.getSecret('s3', 'documents_bucket');
    const client = new S3Client(this.getAWSConfig());
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn: expiry });
  }

  async upload(key: string, fileData: Buffer): Promise<PutObjectCommandOutput> {
    const bucket = await this.secretService.getSecret('s3', 'documents_bucket');
    const client = new S3Client(this.getAWSConfig());

    const params = {
      Bucket: bucket,
      Key: key,
      Body: fileData,
    };
    const command = new PutObjectCommand(params);
    return client.send(command);
  }

  async uploadToS3(params: {
    Bucket: string;
    Key: string;
    Body?: Buffer;
    ContentType?: string;
    ACL?: string;
  }): Promise<PutObjectCommandOutput> {
    const client = new S3Client(this.getAWSConfig());
    const command = new PutObjectCommand(params);
    return client.send(command);
  }

  /**
   * @summary this function will read text from a given file and return an array
   * @param bucket_name
   * @param key
   * @returns extracted data arrya
   */
  async extractText(key: string): Promise<any> {
    const bucket = await this.secretService.getSecret('s3', 'documents_bucket');

    const client = new TextractClient(this.getAWSConfig());

    const fileStream = await this.downloadFromS3({
      Bucket: bucket,
      Key: key,
    });

    let firstPageByteArray;
    let numPages = 1;
    const fileByteArray = await fileStream.transformToByteArray();
    if (key.toLowerCase().endsWith('.pdf')) {
      [firstPageByteArray, numPages] = await extractFirstPage(fileByteArray);
    } else firstPageByteArray = fileByteArray;
    const command = new AnalyzeDocumentCommand({
      Document: {
        Bytes: firstPageByteArray,
      },
      FeatureTypes: ['FORMS'],
    });
    const res = await client.send(command);
    res['numPages'] = numPages;
    return res;
  }

  async getFilePath(filePath: string, fileName: string): Promise<any> {
    const bucket = await this.secretService.getSecret('s3', 'documents_bucket');
    return this.s3Path + bucket + '/' + filePath + fileName;
  }

  async generateUploadUrl(
    filepath: string,
    filename: string,
    contentLength = 10485760, // upto 10MB
    expiry = 120,
    acl: string = 'read',
  ): Promise<PresignedPost> {
    const bucket = await this.secretService.getSecret('s3', 'documents_bucket');
    const client = new S3Client(this.getAWSConfig());
    const response = await createPresignedPost(client, {
      Bucket: bucket,
      Key: filepath + filename,
      Expires: expiry,
      Fields: {
        acl,
      },
      Conditions: [['content-length-range', 1, contentLength || 10485760]],
    });
    return response;
  }

  async copyFilesInS3(params: any): Promise<CopyObjectCommandOutput> {
    const client = new S3Client(this.getAWSConfig());
    const command = new CopyObjectCommand({
      CopySource: params.CopySource,
      Bucket: params.Bucket,
      Key: params.Key,
    });
    return client.send(command);
  }
}
