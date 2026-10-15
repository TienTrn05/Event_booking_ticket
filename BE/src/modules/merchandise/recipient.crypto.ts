import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import { recipientInput, type Recipient } from './merchandise.schema.js';
function key() {
  if (!env.ATTENDEE_PII_KEY)
    throw new AppError(503, 'MERCHANDISE_STORAGE_UNAVAILABLE', 'Chưa cấu hình khóa lưu địa chỉ.');
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(env.ATTENDEE_PII_KEY, 'hex'),
      'eventix-merchandise-v1',
      'recipient',
      32,
    ),
  );
}
export function encryptRecipient(recipient: Recipient, id: string) {
  const iv = randomBytes(12),
    c = createCipheriv('aes-256-gcm', key(), iv);
  c.setAAD(Buffer.from(id));
  const body = Buffer.concat([c.update(JSON.stringify(recipient), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}
export function decryptRecipient(bytes: Buffer, id: string) {
  const c = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  c.setAAD(Buffer.from(id));
  c.setAuthTag(bytes.subarray(12, 28));
  return recipientInput.parse(
    JSON.parse(Buffer.concat([c.update(bytes.subarray(28)), c.final()]).toString('utf8')),
  );
}
