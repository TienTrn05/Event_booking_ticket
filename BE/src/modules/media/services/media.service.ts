import { randomUUID } from 'node:crypto';
import { withConnection } from '../../../shared/database/pool.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { mediaRepository } from '../repositories/media.repository.js';
import { uploadTtlSeconds, type MediaActor, type UploadInput } from '../schemas/media.schema.js';
import { presignImage, verifyReceipt, verifyStoredImage } from '../storage/media.storage.js';

export async function createImageUpload(actor: MediaActor, input: UploadInput) {
  await withConnection((db) => mediaRepository.authorize(db, actor, input));
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[
    input.contentType
  ];
  return presignImage({
    userId: actor.id,
    sessionId: actor.sessionId,
    key: `images/${actor.id}/${randomUUID()}.${extension}`,
    input,
    expiresAt: Date.now() + uploadTtlSeconds * 1000,
  });
}
export async function completeImageUpload(actor: MediaActor, token: string, requestId: string) {
  const receipt = verifyReceipt(token);
  if (receipt.userId !== actor.id || receipt.sessionId !== actor.sessionId)
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.');
  await withConnection((db) => mediaRepository.authorize(db, actor, receipt.input));
  const url = await verifyStoredImage(receipt);
  // Network operations happen before the transaction; permissions are checked again under locks.
  await withTransaction(async (db) => {
    await mediaRepository.authorize(db, actor, receipt.input, true);
    await mediaRepository.save(db, actor, receipt.input, url, requestId);
  });
  return {
    imageUrl: url,
    ...(receipt.input.purpose === 'avatar' ? {} : { version: receipt.input.version + 1 }),
  };
}

export function getAvatar(actor: MediaActor) {
  return withConnection((db) => mediaRepository.avatar(db, actor.id));
}
