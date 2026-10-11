import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.schema.js';
import { parseR2Config } from '../src/config/r2.js';

describe('configuration validation', () => {
  it('rejects partial payOS credentials without exposing their values', () => {
    expect(() => parseEnv({ ...process.env, PAYOS_CLIENT_ID: 'fixture-client-only' })).toThrow(
      'Incomplete payOS or ticket configuration.',
    );
  });
  it('requires the ticket key before enabling payment', () => {
    const config: Record<string, string | undefined> = {
      ...process.env,
      PAYOS_CLIENT_ID: 'fixture-client',
      PAYOS_API_KEY: 'fixture-api',
      PAYOS_CHECKSUM_KEY: 'fixture-checksum',
    };
    delete config.TICKET_ENCRYPTION_KEY;
    expect(() => parseEnv(config)).toThrow('Incomplete payOS or ticket configuration.');
  });
  it('reports invalid Redis URL by field without throwing a raw URL error', () => {
    expect(() => parseEnv({ ...process.env, REDIS_URL: 'invalid-url-fixture' })).toThrow(
      'Invalid environment fields: REDIS_URL',
    );
  });
  it('rejects unsupported Redis protocols', () => {
    expect(() => parseEnv({ ...process.env, REDIS_URL: 'https://example.test' })).toThrow(
      'Invalid environment fields: REDIS_URL',
    );
  });
  it('reports invalid R2 URL by field without including its value', () => {
    expect(() =>
      parseR2Config({
        R2_ACCOUNT_ID: 'a'.repeat(32),
        R2_ACCESS_KEY_ID: 'fixture',
        R2_SECRET_ACCESS_KEY: 'fixture',
        R2_BUCKET_NAME: 'fixture-bucket',
        R2_PUBLIC_URL: 'invalid-url-fixture',
      }),
    ).toThrow('Invalid R2 configuration fields: publicUrl');
  });
});
