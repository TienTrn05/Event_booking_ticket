import { createCipheriv, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
function key(purpose: string) {
  if (!env.ATTENDEE_PII_KEY)
    throw new AppError(
      503,
      'ATTENDEE_STORAGE_UNAVAILABLE',
      'Lưu thông tin giấy tờ chưa được cấu hình.',
    );
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(env.ATTENDEE_PII_KEY, 'hex'),
      'eventix-attendee-v1',
      purpose,
      32,
    ),
  );
}
export function cccdMac(cccd: string, sessionId: string) {
  return createHmac('sha256', key('cccd-match')).update(`${sessionId}:${cccd}`).digest();
}
export function encryptCccd(cccd: string, bookingItemId: string, sessionId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key('cccd-encrypt'), iv);
  cipher.setAAD(Buffer.from(`${bookingItemId}:${sessionId}`));
  const encrypted = Buffer.concat([cipher.update(cccd, 'utf8'), cipher.final()]);
  return {
    ciphertext: Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
    mac: cccdMac(cccd, sessionId),
    lastFour: cccd.slice(-4),
    keyVersion: 'attendee-v1',
  };
}
export function matchesCccd(cccd: string, sessionId: string, expected: Buffer) {
  const actual = cccdMac(cccd, sessionId);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
