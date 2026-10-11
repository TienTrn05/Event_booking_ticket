import { createCipheriv, createDecipheriv, createHash, randomBytes, hkdfSync } from 'node:crypto';
import { env } from '../../../config/env.js';
import { AppError } from '../../../shared/errors/app-error.js';
function key() {
  if (!env.TICKET_ENCRYPTION_KEY)
    throw new AppError(503, 'TICKET_UNAVAILABLE', 'Mã hóa vé chưa được cấu hình.');
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(env.TICKET_ENCRYPTION_KEY, 'hex'),
      'eventix-ticket-v1',
      'ticket-code',
      32,
    ),
  );
}
export const ticketHash = (code: string) => createHash('sha256').update(code).digest();
export function issueCode(itemId: string, sessionId: string) {
  const code = 'EVX-' + randomBytes(16).toString('hex').toUpperCase(),
    iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(`${itemId}:${sessionId}`));
  const bytes = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return {
    hash: ticketHash(code),
    ciphertext: Buffer.concat([iv, cipher.getAuthTag(), bytes]),
    version: 'ticket-v1',
  };
}
export function revealCode(ciphertext: Buffer, itemId: string, sessionId: string, version: string) {
  if (version !== 'ticket-v1')
    throw new AppError(503, 'TICKET_UNAVAILABLE', 'Phiên bản mã vé chưa được hỗ trợ.');
  const cipher = createDecipheriv('aes-256-gcm', key(), ciphertext.subarray(0, 12));
  cipher.setAAD(Buffer.from(`${itemId}:${sessionId}`));
  cipher.setAuthTag(ciphertext.subarray(12, 28));
  return Buffer.concat([cipher.update(ciphertext.subarray(28)), cipher.final()]).toString('utf8');
}
