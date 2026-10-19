import { z } from 'zod';
import { apiRequest } from '../../../shared/api/client';

export type ImageTarget =
  { purpose: 'avatar' } | { purpose: 'event' | 'merchandise'; targetId: string; version: number };
const signedUpload = z.object({
  data: z.object({
    uploadUrl: z.url().refine((value) => {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname.endsWith('.r2.cloudflarestorage.com');
    }),
    method: z.literal('PUT'),
    headers: z
      .object({
        'Content-Type': z.enum(['image/jpeg', 'image/png', 'image/webp']),
        'If-None-Match': z.literal('*'),
      })
      .strict(),
    uploadToken: z.string().min(1),
    expiresIn: z.number().int().positive(),
  }),
});
export async function uploadImage(
  file: File,
  target: ImageTarget,
  accessToken: string,
  signal?: AbortSignal,
) {
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
    file.size < 12 ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error('Chọn ảnh JPEG, PNG hoặc WebP, tối đa 5 MB.');
  const request = {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    ...(signal ? { signal } : {}),
  };
  const signed = signedUpload.parse(
    await apiRequest('/media/uploads', {
      ...request,
      body: JSON.stringify({ ...target, contentType: file.type, size: file.size }),
    }),
  ).data;
  const response = await fetch(signed.uploadUrl, {
    method: signed.method,
    headers: signed.headers,
    body: file,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error('Không tải được ảnh. Vui lòng chọn ảnh và thử lại.');
  const completed = z
    .object({ data: z.object({ imageUrl: z.url(), version: z.number().int().optional() }) })
    .parse(
      await apiRequest('/media/uploads/complete', {
        ...request,
        body: JSON.stringify({ uploadToken: signed.uploadToken }),
      }),
    ).data;
  return {
    imageUrl: completed.imageUrl,
    ...(completed.version === undefined ? {} : { version: completed.version }),
  };
}
export async function getAvatar(accessToken: string, signal?: AbortSignal) {
  return z.object({ data: z.object({ avatarUrl: z.url().nullable() }) }).parse(
    await apiRequest('/media/avatar', {
      headers: { Authorization: `Bearer ${accessToken}` },
      ...(signal ? { signal } : {}),
    }),
  ).data.avatarUrl;
}
