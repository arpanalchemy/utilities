import { Test, TestingModule } from '@nestjs/testing';
import { S3Service } from './s3.service';
import { GetObjectCommand } from '../../__mocks__/@aws-sdk/client-s3';
import { Readable } from 'stream';
import { SecretsService } from '../secretsService/secrets.service';
import { createPresignedPost } from '../__mocks__/@aws-sdk/s3-presigned-post';
import { PutObjectCommand, S3Client, CopyObjectCommand } from '@aws-sdk/client-s3';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({ Body: 'Hello World' } as never),
  })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  CopyObjectCommand: jest.fn(),
}));
const expectedNumPages = 5;
const sendMock = jest.fn().mockResolvedValue({ mock: 'test' });
jest.mock('@aws-sdk/client-textract', () => {
  return {
    TextractClient: jest.fn().mockImplementation(() => {
      return {
        send: sendMock,
      };
    }),
    AnalyzeDocumentCommand: jest.fn().mockImplementation(() => {
      return null;
    }),
  };
});

jest.mock('../../generic-utils/object/object.ts', () => {
  return {
    extractFirstPage: () => [[], expectedNumPages],
  };
});

describe('S3Service', () => {
  let s3Service: S3Service;
  // let s3ClientMock: jest.Mocked<S3Client>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: SecretsService,
          useValue: {
            getSecret: jest.fn(),
          },
        },
      ],
    }).compile();

    s3Service = module.get<S3Service>(S3Service);

    // Create a mock for the S3Client
    // s3ClientMock = new S3Client({ region: "your-region" }) as any;
    // (s3Service as any).s3Client = s3ClientMock;
  });

  it('should download a file from S3', async () => {
    const params = {
      Bucket: 'your-bucket',
      Key: 'your-key',
    };
    const file = Readable.from('Hello World');
    // s3ClientMock.send.mockResolvedValue({ Body: file } as never);
    const result = await s3Service.downloadFromS3(params);
    expect(result).toBe('Hello World');
  });

  it('should return aws config data in getAWSConfig', () => {
    // mock environment variables process.env
    process.env = {
      AWS_REGION: 'ap-south-1',
    };
    const result = (s3Service as any).getAWSConfig();

    // Assertions
    expect(result).toEqual({
      region: 'ap-south-1',
    });
  });

  it('should return presigned url', async () => {
    GetObjectCommand.mockReset();
    jest
      .spyOn((s3Service as any).secretService, 'getSecret')
      .mockResolvedValue('bucket');
    const result = await s3Service.generatePresignedS3Url('key');
    expect(result).toEqual('https://mocked-presigned-url/Bucket/Key');
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'bucket',
      Key: 'key',
    });
  });

  it('should generate a presigned post URL', async () => {
    jest
      .spyOn((s3Service as any).secretService, 'getSecret')
      .mockResolvedValue('your-s3-bucket-name');
  });

  it('should generate a presigned post URL', async () => {
    // Mock the getSecret method from SecretService
    const secretsMock = jest
      .spyOn((s3Service as any).secretService, 'getSecret')
      .mockResolvedValue('test-s3-bucket');

    createPresignedPost.mockResolvedValue({
      url: 'mocked-upload-url',
      fields: {},
    });

    await s3Service.generateUploadUrl(
      'test_path',
      'test_file',
      1,
      1,
      'test_acl',
    );

    expect(createPresignedPost).toHaveBeenCalledWith(expect.anything(), {
      Bucket: 'test-s3-bucket',
      Key: 'test_pathtest_file',
      Expires: 1,
      Fields: {
        acl: 'test_acl',
      },
      Conditions: [['content-length-range', 1, 1]],
    });
    expect(secretsMock).toHaveBeenCalledWith('s3', 'documents_bucket');
  });

  it('should generate a presigned post URL with default', async () => {
    // Mock the getSecret method from SecretService
    createPresignedPost.mockReset();
    const secretsMock = jest
      .spyOn((s3Service as any).secretService, 'getSecret')
      .mockResolvedValue('test-s3-bucket');

    createPresignedPost.mockResolvedValue({
      url: 'mocked-upload-url',
      fields: {},
    });

    await s3Service.generateUploadUrl('/path/', 'example.jpg');

    expect(createPresignedPost).toHaveBeenCalledWith(expect.anything(), {
      Bucket: 'test-s3-bucket',
      Key: '/path/example.jpg',
      Expires: 120,
      Fields: {
        acl: 'read',
      },
      Conditions: [['content-length-range', 1, 10485760]],
    });
    expect(secretsMock).toHaveBeenCalledWith('s3', 'documents_bucket');
  });

  it('should return getFilePath url', async () => {
    expect(
      await s3Service.getFilePath('dev/user/1/kyc/pan/', 'pan.png'),
    ).toContain('s3.ap-south-1.amazonaws.com');
  });

  it('should handle a PDF file correctly', async () => {
    const secretsSpy = jest
      .spyOn((s3Service as any).secretService, 'getSecret')
      .mockResolvedValue('test-bucket-name');
    const downloadFromS3Mock = jest
      .spyOn(s3Service, 'downloadFromS3')
      .mockResolvedValue({ transformToByteArray: () => [] } as any);
    const key = 'example.pdf';

    const result = await s3Service.extractText(key);

    expect(result).toEqual({ mock: 'test', numPages: expectedNumPages });
    expect(secretsSpy).toHaveBeenCalledWith('s3', 'documents_bucket');
    expect(downloadFromS3Mock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.any(Object));
    expect(result.numPages).toEqual(expectedNumPages);
  });

  it('should handle a non-PDF file correctly', async () => {
    const downloadFromS3Mock = jest
      .spyOn(s3Service, 'downloadFromS3')
      .mockResolvedValue({ transformToByteArray: () => { } } as any);
    const secretsSpy = jest
      .spyOn((s3Service as any).secretService, 'getSecret')
      .mockResolvedValue('test-bucket-name');
    const key = 'example.txt';

    const expectedNumPages = 1;

    const result = await s3Service.extractText(key);

    expect(result).toEqual({ mock: 'test', numPages: 1 });
    expect(secretsSpy).toHaveBeenCalledWith('s3', 'documents_bucket');
    expect(downloadFromS3Mock).toHaveBeenCalledTimes(1);
    expect(s3Service.downloadFromS3).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.any(Object));
    expect(result.numPages).toEqual(expectedNumPages);
  });

  it('should upload file to specified S3 bucket', async () => {
    const fileData = Buffer.from('file_content');
    const params = {
      Bucket: 'mocked_bucket_name',
      Key: 'mocked_key',
      Body: fileData,
      ContentType: 'text/plain',
    };

    await s3Service.uploadToS3(params);

    expect(S3Client).toHaveBeenCalledWith(expect.any(Object));
    expect(PutObjectCommand).toHaveBeenCalledWith(params);
  });

  it('should upload file to S3 bucket', async () => {
    jest
      .spyOn((s3Service as any).secretService, 'getSecret')
      .mockResolvedValue('mocked_bucket_name');
    const fileData = Buffer.from('file_content');
    const expectedParams = {
      Bucket: 'mocked_bucket_name',
      Key: 'mocked_key',
      Body: fileData,
    };

    await s3Service.upload('mocked_key', fileData);

    expect(S3Client).toHaveBeenCalledWith(expect.any(Object));
    expect(PutObjectCommand).toHaveBeenCalledWith(expectedParams);
  });

  it('should copy a file within S3', async () => {
    const params = {
      CopySource: 'source-bucket/source-key',
      Bucket: 'destination-bucket',
      Key: 'destination-key',
    };

    const copyObjectCommandMock = jest.fn().mockResolvedValue({ CopyObjectResult: {} });
    (S3Client as jest.Mock).mockImplementation(() => ({
      send: copyObjectCommandMock,
    }));

    const result = await s3Service.copyFilesInS3(params);

    expect(S3Client).toHaveBeenCalledWith(expect.any(Object));
    expect(copyObjectCommandMock).toHaveBeenCalledWith(expect.any(CopyObjectCommand));
    expect(result).toEqual({ CopyObjectResult: {} });
  });
  
});
