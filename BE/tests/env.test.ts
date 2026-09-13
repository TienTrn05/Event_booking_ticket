import { describe, expect, it } from 'vitest';
import { parseEnv } from '../src/config/env.schema.js';
const valid = {
  DB_HOST: 'localhost',
  DB_USER: 'fixture',
  DB_PASSWORD: 'fixture-only',
  DB_NAME: 'fixture',
};
describe('environment validation', () => {
  it('rejects placeholders without exposing their values', () => {
    expect(() => parseEnv({ ...valid, DB_PASSWORD: 'replace_me' })).toThrow(
      'Invalid environment fields: DB_PASSWORD',
    );
  });
  it('rejects an invalid port without echoing arbitrary input', () => {
    expect(() => parseEnv({ ...valid, DB_PORT: 'private-invalid-value' })).toThrow(
      'Invalid environment fields: DB_PORT',
    );
  });
  it('keeps database configuration on the server and validates defaults', () => {
    expect(parseEnv(valid).DB_PORT).toBe(3306);
    expect(Object.isFrozen(parseEnv(valid))).toBe(true);
  });
});
