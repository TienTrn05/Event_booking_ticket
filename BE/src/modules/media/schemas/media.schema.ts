import { z } from 'zod';
import { numericId, versionSchema } from '../../../shared/validation/common.schema.js';

export const maxImageBytes = 5 * 1024 * 1024;
export const uploadTtlSeconds = 300;
const image = {
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size: z.number().int().min(12).max(maxImageBytes),
};
export const uploadSchema = z.discriminatedUnion('purpose', [
  z.object({ purpose: z.literal('avatar'), ...image }).strict(),
  z
    .object({
      purpose: z.literal('event'),
      targetId: numericId,
      version: versionSchema,
      ...image,
    })
    .strict(),
  z
    .object({
      purpose: z.literal('merchandise'),
      targetId: numericId,
      version: versionSchema,
      ...image,
    })
    .strict(),
]);
export const receiptSchema = z
  .object({
    userId: numericId,
    sessionId: numericId,
    key: z.string().regex(/^images\/[1-9][0-9]*\/[a-f0-9-]{36}\.(jpg|png|webp)$/),
    expiresAt: z.number().int(),
    input: uploadSchema,
  })
  .strict();
export type UploadInput = z.infer<typeof uploadSchema>;
export type UploadReceipt = z.infer<typeof receiptSchema>;
export type { RequestActor as MediaActor } from '../../../shared/auth/request-actor.js';

export function isImageHeader(bytes: Uint8Array, type: UploadInput['contentType']) {
  const buffer = Buffer.from(bytes);
  if (type === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (type === 'image/png')
    return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
}

export const completeUploadInput = z.object({ uploadToken: z.string().min(1).max(4096) }).strict();
