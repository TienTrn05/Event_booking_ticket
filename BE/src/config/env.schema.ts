import { z } from 'zod';
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'testing', 'staging', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z
    .string()
    .min(1)
    .refine((value) => value !== 'replace_me'),
  DB_NAME: z.string().regex(/^[a-zA-Z0-9_]+$/),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DB_LOCK_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(60).default(5),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'silent']).default('info'),
});
export function parseEnv(source: NodeJS.ProcessEnv) {
  const result = schema.safeParse(source);
  if (!result.success) {
    // Never include raw values, Zod issues or the complete process.env in logs.
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
    throw new Error(`Invalid environment fields: ${fields.join(', ')}`);
  }
  return Object.freeze(result.data);
}
