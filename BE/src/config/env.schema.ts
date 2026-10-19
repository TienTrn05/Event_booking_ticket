import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'testing', 'staging', 'production']).default('development'),
  LOCAL_COMPOSE: z.enum(['true', 'false']).default('false'),
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
  REDIS_URL: z
    .url()
    .pipe(z.string().refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol)))
    .optional(),
  REDIS_PREFIX: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,48}$/)
    .default('eventix'),
  ELASTICSEARCH_URL: z.url().optional(),
  ELASTICSEARCH_USERNAME: z.string().min(1).optional(),
  ELASTICSEARCH_PASSWORD: z.string().min(1).optional(),
  ELASTICSEARCH_API_KEY: z.string().min(1).optional(),
  ELASTICSEARCH_INDEX: z
    .string()
    .regex(/^[a-z][a-z0-9_-]{0,79}$/)
    .default('eventix-events-v1'),
  WAITING_ROOM_CAPACITY: z.coerce.number().int().min(1).max(1000).default(100),
  WAITING_ROOM_MAX_QUEUE: z.coerce.number().int().min(1).max(100000).default(10000),
  WAITING_ROOM_ADMIT_PER_SECOND: z.coerce.number().int().min(1).max(1000).default(20),
  WAITING_ROOM_LEASE_SECONDS: z.coerce.number().int().min(30).max(1800).default(600),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
  READINESS_REQUIRE_WORKERS: z.enum(['true', 'false']).optional(),
  WORKER_STALE_SECONDS: z.coerce.number().int().min(15).max(600).default(60),
  WORKER_JOB_TIMEOUT_SECONDS: z.coerce.number().int().min(30).max(900).default(120),
  WORKER_HEALTH_DIRECTORY: z.string().min(1).optional(),
  SUPERVISED_PROCESS: z.enum(['true', 'false']).default('false'),
  HTTPS_CERT_FILE: z.string().min(1).optional(),
  HTTPS_KEY_FILE: z.string().min(1).optional(),
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
  PAYOS_CLIENT_ID: z.string().min(1).optional(),
  PAYOS_API_KEY: z.string().min(1).optional(),
  PAYOS_CHECKSUM_KEY: z.string().min(1).optional(),
  TICKET_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  ATTENDEE_PII_KEY: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});
export function parseEnv(source: NodeJS.ProcessEnv) {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Never include raw values, Zod issues or the complete process.env in logs.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment fields: ${fields.join(', ')}`);
  }
  const es = result.data;
  if (es.LOCAL_COMPOSE === 'true') {
    if (!['development', 'testing'].includes(es.APP_ENV))
      throw new Error('Local Compose is limited to development/testing.');
    if (es.REDIS_URL) {
      // Keep the encoded password and logical DB; only change the container endpoint.
      const redis = new URL(es.REDIS_URL);
      redis.hostname = 'redis';
      redis.port = '6379';
      es.REDIS_URL = redis.toString();
    }
  }
  if (es.ELASTICSEARCH_URL) {
    const url = new URL(es.ELASTICSEARCH_URL);
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      !['http:', 'https:'].includes(url.protocol)
    )
      throw new Error('Invalid Elasticsearch endpoint.');
    if (
      url.protocol !== 'https:' &&
      (!['development', 'testing'].includes(es.APP_ENV) ||
        !(
          ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
          (es.LOCAL_COMPOSE === 'true' && url.hostname === 'elasticsearch')
        ))
    )
      throw new Error('Elasticsearch requires HTTPS outside local development/testing.');
    if (
      Boolean(es.ELASTICSEARCH_USERNAME) !== Boolean(es.ELASTICSEARCH_PASSWORD) ||
      (Boolean(es.ELASTICSEARCH_API_KEY) && Boolean(es.ELASTICSEARCH_USERNAME))
    )
      throw new Error('Invalid Elasticsearch credentials.');
    if (!es.ELASTICSEARCH_API_KEY && !es.ELASTICSEARCH_PASSWORD)
      throw new Error('Elasticsearch authentication is required.');
  } else if (es.ELASTICSEARCH_USERNAME || es.ELASTICSEARCH_PASSWORD || es.ELASTICSEARCH_API_KEY)
    throw new Error('Elasticsearch endpoint is required.');
  const googleFields = [
    result.data.GOOGLE_CLIENT_ID,
    result.data.GOOGLE_CLIENT_SECRET,
    result.data.GOOGLE_REDIRECT_URI,
  ];
  const sessionFields = [result.data.PUBLIC_APP_URL, result.data.JWT_ACCESS_SECRET];
  if (Boolean(result.data.HTTPS_CERT_FILE) !== Boolean(result.data.HTTPS_KEY_FILE))
    throw new Error('Incomplete local HTTPS configuration.');
  if (result.data.HTTPS_CERT_FILE && !['development', 'testing'].includes(result.data.APP_ENV))
    throw new Error('Local HTTPS certificates are limited to development/testing.');
  const emailFields = [result.data.SMTP_USER, result.data.SMTP_PASSWORD];
  const payosFields = [
    result.data.PAYOS_CLIENT_ID,
    result.data.PAYOS_API_KEY,
    result.data.PAYOS_CHECKSUM_KEY,
  ];
  if (
    payosFields.some(Boolean) &&
    (!payosFields.every(Boolean) ||
      !result.data.PUBLIC_APP_URL ||
      !result.data.TICKET_ENCRYPTION_KEY)
  )
    throw new Error('Incomplete payOS or ticket configuration.');
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
