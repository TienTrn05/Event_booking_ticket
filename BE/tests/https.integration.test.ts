import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { request as httpsRequest } from 'node:https';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import type * as AppModule from '../src/app.js';
import type * as DatabaseModule from '../src/shared/database/pool.js';
describe.skipIf(!process.env.COMMERCE_TEST_DB_PORT)(
  'local HTTPS against isolated PostgreSQL',
  () => {
    let server: Server,
      port: number,
      ca: Buffer,
      appModule: typeof AppModule,
      db: typeof DatabaseModule;
    beforeAll(async () => {
      process.env.PUBLIC_APP_URL = 'https://localhost:3443';
      process.env.APP_ENV = 'staging';
      process.env.READINESS_REQUIRE_WORKERS = 'false';
      appModule = await import('../src/app.js');
      db = await import('../src/shared/database/pool.js');
      const { createHttpServer } = await import('../src/startup/http-server.js');
      const certFile = fileURLToPath(new URL('../.local/https/localhost.crt', import.meta.url)),
        keyFile = fileURLToPath(new URL('../.local/https/localhost.key', import.meta.url));
      ca = await readFile(certFile);
      server = createHttpServer(
        appModule.createApp({ checkDatabase: db.checkDatabase, logRequest: () => {} }),
        { certFile, keyFile },
      );
      await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
      port = (server.address() as { port: number }).port;
    });
    afterAll(async () => {
      if (server) await new Promise<void>((done) => server.close(() => done()));
      if (db) await db.pool.end();
    });
    const send = (
      path: string,
      method = 'GET',
      headers: Record<string, string> = {},
      servername = 'localhost',
    ) =>
      new Promise<{ status: number; body: Record<string, unknown>; cookies: string[] }>(
        (resolve, reject) => {
          const req = httpsRequest(
            {
              host: '127.0.0.1',
              port,
              servername,
              ca,
              rejectUnauthorized: true,
              path: '/api/v1' + path,
              method,
              headers,
            },
            (res) => {
              let body = '';
              res.on('data', (chunk) => {
                body += String(chunk);
              });
              res.on('end', () =>
                resolve({
                  status: res.statusCode!,
                  body: JSON.parse(body) as Record<string, unknown>,
                  cookies: res.headers['set-cookie'] ?? [],
                }),
              );
            },
          );
          req.on('error', reject);
          req.end(method === 'GET' ? undefined : '{}');
        },
      );
    it('validates TLS identity and detects missing business schema while liveness stays available', async () => {
      expect((await send('/health/ready')).status).toBe(200);
      await expect(send('/health/live', 'GET', {}, 'foreign.invalid')).rejects.toMatchObject({
        code: 'ERR_TLS_CERT_ALTNAME_INVALID',
      });
      await db.pool.query(
        'ALTER TABLE event_sessions RENAME COLUMN pricing_config TO missing_prices_fixture',
      );
      try {
        const response = await send('/health/ready');
        expect(response.status).toBe(503);
        expect(JSON.stringify(response.body)).not.toMatch(/password|pricing_config|stack|DB_HOST/);
        expect((await send('/health/live')).status).toBe(200);
      } finally {
        await db.pool.query(
          'ALTER TABLE event_sessions RENAME COLUMN missing_prices_fixture TO pricing_config',
        );
      }
      expect((await send('/health/ready')).status).toBe(200);
    });
    it('refreshes a fixture session over TLS with Secure cookies and rejects foreign Origin/invalid CSRF', async () => {
      const user = (
        await db.pool.query(
          "INSERT INTO users(display_name) VALUES('HTTPS fixture') RETURNING id::text",
        )
      ).rows[0].id as string;
      const identity = (
        await db.pool.query(
          "INSERT INTO external_identities(user_id,provider,subject,email_canonical,email_verified_at,verified_at) VALUES($1,'EMAIL',$2,$2,now(),now()) RETURNING id::text",
          [user, randomUUID() + '@fixture.invalid'],
        )
      ).rows[0].id as string;
      const { createSession } = await import('../src/modules/auth/session/session.service.js'),
        { withTransaction } = await import('../src/shared/database/transaction.js');
      const session = await withTransaction((client) =>
        createSession(
          client,
          { userId: user, identityId: identity, displayName: 'HTTPS fixture', authVersion: 0 },
          randomUUID(),
        ),
      );
      const headers = {
        'content-type': 'application/json',
        origin: 'https://localhost:3443',
        cookie: 'eventix.refresh=' + session.refreshToken + '; eventix.csrf=fixture-proof',
        'x-csrf-token': 'fixture-proof',
      };
      expect(
        (await send('/auth/refresh', 'POST', { ...headers, origin: 'https://foreign.invalid' }))
          .status,
      ).toBe(403);
      expect(
        (await send('/auth/refresh', 'POST', { ...headers, 'x-csrf-token': 'wrong-proof' })).status,
      ).toBe(403);
      const response = await send('/auth/refresh', 'POST', headers);
      expect(response.status).toBe(200);
      const attributes = response.cookies.map((cookie) => cookie.split(';').slice(1).join(';'));
      expect(
        attributes.some(
          (value) =>
            value.includes('Secure') &&
            value.includes('HttpOnly') &&
            value.includes('SameSite=Lax'),
        ),
      ).toBe(true);
      expect((await send('/admin/operations/health')).status).toBe(401);
      const access = (response.body.data as { accessToken: string }).accessToken;
      expect(
        (await send('/admin/operations/health', 'GET', { authorization: 'Bearer ' + access }))
          .status,
      ).toBe(403);
      await db.pool.query(
        "INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",
        [user],
      );
      const operational = await send('/admin/operations/health', 'GET', {
        authorization: 'Bearer ' + access,
      });
      expect(operational.status).toBe(200);
      const report = operational.body.data as {
        backlog: { outboxPending: number };
        workers: unknown[];
      };
      expect(typeof report.backlog.outboxPending).toBe('number');
      expect(report.workers).toHaveLength(2);
    });
  },
);
