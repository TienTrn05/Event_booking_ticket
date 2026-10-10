import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';

let app: Express;
beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client.apps.googleusercontent.com');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-client-secret');
  vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://127.0.0.1:5173/api/v1/auth/google/callback');
  vi.stubEnv('PUBLIC_APP_URL', 'http://127.0.0.1:5173/');
  vi.stubEnv(
    'JWT_ACCESS_SECRET',
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  );
  vi.stubEnv('APP_ENV', 'development');
  const { createApp } = await import('../src/app.js');
  app = createApp({ checkDatabase: async () => {} });
});

describe('Google OAuth browser boundary', () => {
  it('requires same origin and a CSRF token before starting Google login', async () => {
    const rejected = await request(app)
      .post('/api/v1/auth/google/start')
      .set('Origin', 'https://attacker.example');
    expect(rejected.status).toBe(403);

    const csrf = await request(app).get('/api/v1/auth/csrf');
    expect(csrf.status).toBe(200);
    const cookie = csrf.headers['set-cookie'] as unknown as string[];
    const token = csrf.body.data.csrfToken as string;
    const started = await request(app)
      .post('/api/v1/auth/google/start')
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Cookie', cookie.map((value) => value.split(';')[0]!).join('; '))
      .set('x-csrf-token', token);
    expect(started.status).toBe(200);
    const url = new URL(started.body.data.authorizationUrl as string);
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('nonce')).toBeTruthy();
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(started.headers['set-cookie']).toBeDefined();
  });

  it('rejects mismatched OAuth state before token exchange', async () => {
    const response = await request(app).get('/api/v1/auth/google/callback?code=unused&state=wrong');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      'http://127.0.0.1:5173/?auth=error&authReason=INVALID_OAUTH_STATE',
    );
  });
});

describe('private auth metadata and callback outcomes', () => {
  it('requires a valid session before exposing login methods', async () => {
    const response = await request(app).get('/api/v1/auth/methods');
    expect(response.status).toBe(401);
    expect(response.body.data).toBeUndefined();
  });
  it('returns a safe cancellation reason without provider details', async () => {
    const response = await request(app).get('/api/v1/auth/google/callback?error=access_denied');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(
      'http://127.0.0.1:5173/?auth=error&authReason=GOOGLE_CANCELLED',
    );
  });
});

describe('refresh family in PostgreSQL', () => {
  it.skipIf(process.env.AUTH_TEST_DB !== '1')(
    'creates only a Customer from a verified Google subject',
    async () => {
      const { startGoogle, finishGoogle } = await import('../src/modules/auth/auth.service.js');
      const { withTransaction } = await import('../src/shared/database/transaction.js');
      const started = startGoogle();
      const state = new URL(started.url).searchParams.get('state')!;
      const payload = JSON.parse(
        Buffer.from(started.stateCookie.split('.')[0]!, 'base64url').toString('utf8'),
      ) as { nonce: string };
      const subject = randomUUID();
      vi.spyOn(OAuth2Client.prototype, 'getToken').mockImplementation(
        async () =>
          ({
            tokens: { id_token: 'test-id-token' },
          }) as never,
      );
      vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockImplementation(
        async () =>
          ({
            getPayload: () => ({
              sub: subject,
              nonce: payload.nonce,
              name: 'Google Test',
              email: 'test@example.invalid',
              email_verified: true,
            }),
          }) as never,
      );
      const session = await finishGoogle('test-code', state, started.stateCookie, 'auth-test');
      try {
        const roles = await withTransaction(async (db) =>
          db.query<{ code: string }>(
            'SELECT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1',
            [session.userId],
          ),
        );
        expect(roles.rows.map((row) => row.code)).toEqual(['CUSTOMER']);
      } finally {
        await withTransaction(async (db) => {
          await db.query('DELETE FROM audit_logs WHERE resource_type = $1 AND resource_id = $2', [
            'auth_session',
            session.sessionId,
          ]);
          await db.query('DELETE FROM refresh_tokens WHERE session_id = $1', [session.sessionId]);
          await db.query('DELETE FROM auth_sessions WHERE id = $1', [session.sessionId]);
          await db.query('DELETE FROM user_roles WHERE user_id = $1', [session.userId]);
          await db.query('DELETE FROM external_identities WHERE user_id = $1', [session.userId]);
          await db.query('DELETE FROM users WHERE id = $1', [session.userId]);
        });
      }
    },
  );

  it.skipIf(process.env.AUTH_TEST_DB !== '1')(
    'rotates once and revokes the device on replay',
    async () => {
      const { withTransaction } = await import('../src/shared/database/transaction.js');
      const { rotateRefresh, accessToken, currentUser } =
        await import('../src/modules/auth/auth.service.js');
      const original = randomBytes(32).toString('base64url');
      const ids = await withTransaction(async (connection) => {
        const user = await connection.query<{ id: string }>(
          `INSERT INTO users (display_name) VALUES ('Auth test') RETURNING id::text`,
        );
        const userId = user.rows[0]!.id;
        const identity = await connection.query<{ id: string }>(
          `INSERT INTO external_identities (user_id, provider, subject, verified_at)
         VALUES ($1, 'GOOGLE', $2, CURRENT_TIMESTAMP) RETURNING id::text`,
          [userId, randomUUID()],
        );
        const session = await connection.query<{ id: string; expires_at: Date }>(
          `INSERT INTO auth_sessions (user_id, identity_id, authenticated_at, family_id, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3, CURRENT_TIMESTAMP + INTERVAL '7 days')
         RETURNING id::text, expires_at`,
          [userId, identity.rows[0]!.id, randomBytes(32)],
        );
        const sessionId = session.rows[0]!.id;
        await connection.query(
          `INSERT INTO refresh_tokens (session_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
          [sessionId, createHash('sha256').update(original).digest(), session.rows[0]!.expires_at],
        );
        return { userId, sessionId };
      });
      try {
        const rotated = await rotateRefresh(original, 'auth-test');
        expect(rotated.refreshToken).not.toBe(original);
        expect(await currentUser(`Bearer ${await accessToken(rotated)}`)).toEqual({
          id: ids.userId,
          displayName: 'Auth test',
        });
        await expect(rotateRefresh(original, 'auth-test')).rejects.toMatchObject({
          code: 'REFRESH_REUSED',
        });
        await expect(currentUser(`Bearer ${await accessToken(rotated)}`)).rejects.toMatchObject({
          code: 'UNAUTHENTICATED',
        });
      } finally {
        await withTransaction(async (connection) => {
          await connection.query(
            'DELETE FROM audit_logs WHERE resource_type = $1 AND resource_id = $2',
            ['auth_session', ids.sessionId],
          );
          await connection.query('DELETE FROM refresh_tokens WHERE session_id = $1', [
            ids.sessionId,
          ]);
          await connection.query('DELETE FROM auth_sessions WHERE id = $1', [ids.sessionId]);
          await connection.query('DELETE FROM external_identities WHERE user_id = $1', [
            ids.userId,
          ]);
          await connection.query('DELETE FROM users WHERE id = $1', [ids.userId]);
        });
      }
    },
  );
});
