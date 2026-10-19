import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { secret } from './auth.config.js';
export const random = () => randomBytes(32).toString('base64url');

export const hash = (value: string) => createHash('sha256').update(value).digest();

export const b64 = (value: Buffer) => value.toString('base64url');

export function signState(value: string) {
  return b64(createHmac('sha256', secret).update(value).digest());
}

export function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
