// Tests use explicit fixtures and never load BE/.env or external provider credentials.
for (const key of Object.keys(process.env)) {
  if (key === 'SUPERVISED_PROCESS') delete process.env[key];
  if (
    /^(GOOGLE_|SMTP_|JWT_|OTP_|REDIS_|ELASTICSEARCH_|R2_|R3_|ATTENDEE_|PAYOS_|TICKET_|HTTPS_|READINESS_|WORKER_)/.test(
      key,
    )
  )
    delete process.env[key];
}
Object.assign(process.env, {
  NODE_ENV: 'test',
  APP_ENV: 'development',
  DB_HOST: '127.0.0.1',
  DB_PORT: process.env.COMMERCE_TEST_DB_PORT ?? '5432',
  DB_USER: 'validation_fixture',
  DB_PASSWORD: 'validation_fixture_only',
  DB_NAME: 'validation_fixture',
  PUBLIC_APP_URL: `http://127.0.0.1:${process.env.COMMERCE_TEST_APP_PORT ?? '5173'}`,
  JWT_ACCESS_SECRET: 'a'.repeat(64),
  TICKET_ENCRYPTION_KEY: 'b'.repeat(64),
  ATTENDEE_PII_KEY: 'c'.repeat(64),
  LOG_LEVEL: 'silent',
});
