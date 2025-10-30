import { S3Client } from "@aws-sdk/client-s3";

export const getSignedUrl = jest.fn(
  (client: S3Client, command: any, options: any) => {
    return `https://mocked-presigned-url/Bucket/Key`;
  }
);
