import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'testing', 'staging', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z
    .string()
    .min(1)
    .refine((value) => value !== 'replace_me'),
  DB_NAME: z.string().regex(/^[a-zA-Z0-9_]+$/),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_LOCK_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(60).default(5),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_REDIRECT_URI: z.url().optional(),
  PUBLIC_APP_URL: z.url().optional(),
  JWT_ACCESS_SECRET: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  JWT_ISSUER: z.string().min(1).default('eventix-api'),
  JWT_AUDIENCE: z.string().min(1).default('eventix-web'),
  OTP_HMAC_KEY: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  SMTP_USER: z.email().optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
});
export function parseEnv(source: NodeJS.ProcessEnv) {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Never include raw values, Zod issues or the complete process.env in logs.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment fields: ${fields.join(', ')}`);
  }
  const googleFields = [
    result.data.GOOGLE_CLIENT_ID,
    result.data.GOOGLE_CLIENT_SECRET,
    result.data.GOOGLE_REDIRECT_URI,
  ];
  const sessionFields = [result.data.PUBLIC_APP_URL, result.data.JWT_ACCESS_SECRET];
  const emailFields = [result.data.SMTP_USER, result.data.SMTP_PASSWORD];
  if (
    googleFields.some(Boolean) &&
    (!googleFields.every(Boolean) || !sessionFields.every(Boolean))
  ) {
    throw new Error('Incomplete Google auth configuration.');
  }
  if (
    emailFields.some(Boolean) &&
    (!emailFields.every(Boolean) || !result.data.OTP_HMAC_KEY || !sessionFields.every(Boolean))
  ) {
    throw new Error('Incomplete email OTP configuration.');
  }
  if (
    (result.data.APP_ENV === 'production' || sessionFields.some(Boolean)) &&
    !sessionFields.every(Boolean)
  ) {
    // A generated JWT key alone is allowed for catalog-only local setup.
    if (result.data.APP_ENV === 'production' || result.data.PUBLIC_APP_URL)
      throw new Error('Incomplete session configuration.');
  }
  if (result.data.PUBLIC_APP_URL) {
    const app = new URL(result.data.PUBLIC_APP_URL!);
    if (
      app.pathname !== '/' ||
      app.search ||
      app.hash ||
      (app.protocol !== 'https:' &&
        !(
          result.data.APP_ENV === 'development' &&
          app.protocol === 'http:' &&
          app.hostname === '127.0.0.1'
        ))
    ) {
      throw new Error('Invalid Google auth origin or redirect URI.');
    }
    if (result.data.GOOGLE_REDIRECT_URI) {
      const redirect = new URL(result.data.GOOGLE_REDIRECT_URI);
      if (
        redirect.origin !== app.origin ||
        redirect.pathname !== '/api/v1/auth/google/callback' ||
        redirect.search ||
        redirect.hash
      ) {
        throw new Error('Invalid Google auth origin or redirect URI.');
      }
    }
  }
  return Object.freeze(result.data);
}
