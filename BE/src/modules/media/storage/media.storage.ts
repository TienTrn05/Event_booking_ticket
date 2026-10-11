import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { r2Client, r2Config } from '../../../config/r2.js';
import { AppError } from '../../../shared/errors/app-error.js';
import {
  isImageHeader,
  receiptSchema,
  uploadTtlSeconds,
  type UploadReceipt,
} from '../schemas/media.schema.js';

function configuration() {
  if (!r2Client || !r2Config)
    throw new AppError(503, 'STORAGE_UNAVAILABLE', 'Lưu ảnh chưa được cấu hình.');
  return { client: r2Client, config: r2Config };
}
function mac(value: string) {
  return createHmac('sha256', configuration().config.secretAccessKey)
    .update('eventix-media-v1\0')
    .update(value)
    .digest();
}
export function signReceipt(receipt: UploadReceipt) {
  const body = Buffer.from(JSON.stringify(receipt)).toString('base64url');
  return `${body}.${mac(body).toString('base64url')}`;
}
export function verifyReceipt(value: string): UploadReceipt {
  try {
    const [body, signature, extra] = value.split('.');
    if (!body || !signature || extra) throw new Error('Malformed receipt');
    const actual = Buffer.from(signature, 'base64url');
    const expected = mac(body);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      throw new Error('Invalid signature');
    const receipt = receiptSchema.parse(
      JSON.parse(Buffer.from(body, 'base64url').toString('utf8')),
    );
    if (Date.now() >= receipt.expiresAt) throw new Error('Expired receipt');
    return receipt;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'INVALID_UPLOAD', 'Thông tin upload không hợp lệ hoặc đã hết hạn.');
  }
}
export function imageUrl(key: string) {
  return `${configuration().config.publicUrl.replace(/\/$/, '')}/${key}`;
}
export async function presignImage(receipt: UploadReceipt) {
  const { client, config } = configuration();
  // Content-Length is supplied automatically by the browser for a File body.
  // A signed If-None-Match prevents the URL from overwriting an accepted image.
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: receipt.key,
      ContentType: receipt.input.contentType,
      ContentLength: receipt.input.size,
      IfNoneMatch: '*',
    }),
    {
      expiresIn: uploadTtlSeconds,
      signableHeaders: new Set(['content-type', 'content-length', 'if-none-match']),
    },
  );
  return {
    uploadUrl: url,
    method: 'PUT' as const,
    headers: { 'Content-Type': receipt.input.contentType, 'If-None-Match': '*' },
    uploadToken: signReceipt(receipt),
    expiresIn: uploadTtlSeconds,
  };
}
export async function verifyStoredImage(receipt: UploadReceipt) {
  const { client, config } = configuration();
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: receipt.key }),
    );
    if (
      head.ContentLength !== receipt.input.size ||
      head.ContentType !== receipt.input.contentType ||
      !head.ETag
    )
      throw new AppError(400, 'INVALID_IMAGE', 'Ảnh upload không đúng định dạng hoặc kích thước.');
    // Read only the signature, never proxy the image upload through the API.
    const prefix = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: receipt.key,
        Range: 'bytes=0-11',
        IfMatch: head.ETag,
      }),
    );
    if (
      !prefix.Body ||
      !isImageHeader(await prefix.Body.transformToByteArray(), receipt.input.contentType)
    )
      throw new AppError(400, 'INVALID_IMAGE', 'Ảnh upload không đúng định dạng.');
    return imageUrl(receipt.key);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      409,
      'UPLOAD_NOT_READY',
      'Chưa xác nhận được ảnh trên R2. Vui lòng thử lại.',
    );
  }
}
