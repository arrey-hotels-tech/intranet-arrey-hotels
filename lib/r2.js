import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let client;

function r2Client() {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export function createUploadUrl(bucket, key, contentType) {
  return getSignedUrl(r2Client(), new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 600 });
}

export function createDownloadUrl(bucket, key) {
  return getSignedUrl(r2Client(), new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 });
}

export function headObject(bucket, key) {
  return r2Client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

export function deleteObject(bucket, key) {
  return r2Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
