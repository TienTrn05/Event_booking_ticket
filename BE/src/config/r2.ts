import { S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';
import './env.js';

const configuration = z.object({
  accountId: z.string().regex(/^[a-fA-F0-9]{32}$/),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucket: z.string().regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/),
  publicUrl: z.url().pipe(
    z.string().refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash &&
        !url.hostname.endsWith('.r2.cloudflarestorage.com')
      );
    }),
  ),
});

export function parseR2Config(source: NodeJS.ProcessEnv) {
  const values = {
    accountId: source.R2_ACCOUNT_ID ?? source.R3_Account_ID,
    accessKeyId: source.R2_ACCESS_KEY_ID ?? source.R3_ACCESS_KEY_ID,
    secretAccessKey: source.R2_SECRET_ACCESS_KEY ?? source.R3_SECRET_ACCESS_KEY,
    bucket: source.R2_BUCKET_NAME ?? source.R3_BUCKET_NAME,
    publicUrl: source.R2_PUBLIC_URL ?? source.R3_URL,
  };
  if (Object.values(values).every((value) => !value)) return null;
  const result = configuration.safeParse(values);
  if (!result.success) {
    throw new Error(
      `Invalid R2 configuration fields: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  return Object.freeze(result.data);
}

export const r2Config = parseR2Config(process.env);
export const r2Client = r2Config
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: r2Config.accessKeyId, secretAccessKey: r2Config.secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 2,
      requestHandler: { connectionTimeout: 5000, requestTimeout: 15000 },
    })
  : null;
