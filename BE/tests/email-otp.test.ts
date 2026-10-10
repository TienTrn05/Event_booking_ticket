import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { OAuth2Client } from 'google-auth-library';
import type { Express } from 'express';
import type * as OtpService from '../src/modules/auth/otp.service.js';
import type * as AuthService from '../src/modules/auth/auth.service.js';
import type * as EmailDelivery from '../src/modules/auth/email-delivery.js';
import type * as Transaction from '../src/shared/database/transaction.js';

let app: Express;
let otpService: typeof OtpService;
let auth: typeof AuthService;
let delivery: typeof EmailDelivery;
let transaction: typeof Transaction;
const emails: string[] = [];
const subjects: string[] = [];
const codes = new Map<string, string>();
const binding = 'test-browser-binding';
function email() {
  const value = `otp-${randomUUID()}@example.invalid`;
  emails.push(value);
  return value;
}
const login = (identifier: string, phone?: string) =>
  otpService.requestOtp({ identifier, purpose: 'LOGIN', ...(phone ? { phone } : {}) }, binding);
const verify = (id: string, target: string, header?: string) =>
  otpService.verifyOtp(
    { challengeId: id, code: codes.get(target)! },
    binding,
    'email-otp-test',
    header,
  );

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APP_ENV', 'development');
  vi.stubEnv('PUBLIC_APP_URL', 'http://127.0.0.1:5173/');
  vi.stubEnv('GOOGLE_REDIRECT_URI', 'http://127.0.0.1:5173/api/v1/auth/google/callback');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test.apps.googleusercontent.com');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-google-secret');
  vi.stubEnv('JWT_ACCESS_SECRET', '1'.repeat(64));
  vi.stubEnv('OTP_HMAC_KEY', '2'.repeat(64));
  vi.stubEnv('SMTP_USER', 'sender@example.invalid');
  vi.stubEnv('SMTP_PASSWORD', 'test-only-password');
  otpService = await import('../src/modules/auth/otp.service.js');
  auth = await import('../src/modules/auth/auth.service.js');
  delivery = await import('../src/modules/auth/email-delivery.js');
  transaction = await import('../src/shared/database/transaction.js');
  const { createApp } = await import('../src/app.js');
  app = createApp({ checkDatabase: async () => {} });
});
beforeEach(() => {
  vi.spyOn(delivery.emailDelivery, 'send').mockImplementation(async (to, code) => {
    codes.set(to, code);
  });
});
afterAll(async () => {
  if (process.env.AUTH_TEST_DB !== '1') return;
  await transaction.withTransaction(async (db) => {
    await db.query('DELETE FROM otp_challenges WHERE target_canonical = ANY($1::text[])', [emails]);
    const users = await db.query<{ user_id: string }>(
      'SELECT DISTINCT user_id::text FROM external_identities WHERE email_canonical = ANY($1::text[]) OR subject = ANY($2::text[])',
      [emails, subjects],
    );
    const ids = users.rows.map((row) => row.user_id);
    await db.query('DELETE FROM audit_logs WHERE actor_id = ANY($1::bigint[])', [ids]);
    await db.query(
      'DELETE FROM refresh_tokens WHERE session_id IN (SELECT id FROM auth_sessions WHERE user_id = ANY($1::bigint[]))',
      [ids],
    );
    await db.query('DELETE FROM auth_sessions WHERE user_id = ANY($1::bigint[])', [ids]);
    await db.query(
      'DELETE FROM phone_login_aliases WHERE email_identity_id IN (SELECT id FROM external_identities WHERE user_id = ANY($1::bigint[]))',
      [ids],
    );
    await db.query('DELETE FROM external_identities WHERE user_id = ANY($1::bigint[])', [ids]);
    await db.query('DELETE FROM user_roles WHERE user_id = ANY($1::bigint[])', [ids]);
    await db.query('DELETE FROM users WHERE id = ANY($1::bigint[])', [ids]);
  });
});

async function google(
  target: string,
  link?: Awaited<ReturnType<typeof auth.linkingActor>>,
  subject = randomUUID(),
) {
  subjects.push(subject);
  const started = auth.startGoogle(link);
  const state = new URL(started.url).searchParams.get('state')!;
  const payload = JSON.parse(
    Buffer.from(started.stateCookie.split('.')[0]!, 'base64url').toString('utf8'),
  ) as { nonce: string };
  vi.spyOn(OAuth2Client.prototype, 'getToken').mockResolvedValue({
    tokens: { id_token: 'mock-google' },
  } as never);
  vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
    getPayload: () => ({
      sub: subject,
      nonce: payload.nonce,
      email: target,
      email_verified: true,
      name: 'OTP integration test',
    }),
  } as never);
  return auth.finishGoogle('mock-code', state, started.stateCookie, 'email-otp-test');
}

describe('email OTP HTTP boundary', () => {
  it('rejects missing CSRF, wrong Origin and arbitrary fields without sending email', async () => {
    const rejected = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ identifier: 'test@example.invalid' });
    expect(rejected.status).toBe(403);
    const csrf = await request(app).get('/api/v1/auth/csrf');
    const cookie = (csrf.headers['set-cookie'] as unknown as string[])
      .map((value) => value.split(';')[0]!)
      .join('; ');
    const invalid = await request(app)
      .post('/api/v1/auth/otp/request')
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Cookie', cookie)
      .set('x-csrf-token', csrf.body.data.csrfToken as string)
      .send({ identifier: 'test@example.invalid', userId: '1' });
    expect(invalid.status).toBe(400);
    expect(delivery.emailDelivery.send).not.toHaveBeenCalled();
  });
  it('normalizes phone aliases and email without Gmail dot merging', () => {
    expect(otpService.normalizePhone('0935 572 707')).toBe('+84935572707');
    expect(otpService.normalizeEmail(' A.B@gmail.com ')).toBe('a.b@gmail.com');
    expect(() => otpService.normalizePhone('123')).toThrow();
  });
});

describe.skipIf(process.env.AUTH_TEST_DB !== '1')('email OTP on isolated PostgreSQL', () => {
  it('creates one Customer, logs in by phone alias and preserves user across email logins', async () => {
    const target = email(),
      phone = `+84${Math.floor(Math.random() * 1e9)
        .toString()
        .padStart(9, '0')}`;
    const challenge = await login(target, phone);
    const session = await verify(challenge.challengeId, target);
    const roles = await transaction.withTransaction((db) =>
      db.query<{ code: string }>(
        'SELECT r.code FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=$1',
        [session.userId],
      ),
    );
    expect(roles.rows.map((row) => row.code)).toEqual(['CUSTOMER']);
    await transaction.withTransaction((db) =>
      db.query(
        "UPDATE otp_challenges SET created_at=CURRENT_TIMESTAMP - INTERVAL '61 seconds' WHERE challenge_id=$1",
        [Buffer.from(challenge.challengeId, 'base64url')],
      ),
    );
    const next = await login(phone);
    expect((await verify(next.challengeId, target)).userId).toBe(session.userId);
    const identity = await transaction.withTransaction((db) =>
      db.query<{ provider: string }>('SELECT provider FROM external_identities WHERE user_id=$1', [
        session.userId,
      ]),
    );
    expect(identity.rows.map((row) => row.provider)).toEqual(['EMAIL']);
  });
  it('consumes OTP exactly once under concurrent verify', async () => {
    const target = email(),
      c = await login(target);
    const results = await Promise.allSettled([
      verify(c.challengeId, target),
      verify(c.challengeId, target),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
  it('rejects another browser without consuming the valid proof', async () => {
    const target = email(),
      c = await login(target);
    await expect(
      otpService.verifyOtp(
        { challengeId: c.challengeId, code: codes.get(target)! },
        'other-browser',
        'email-otp-test',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OTP' });
    expect((await verify(c.challengeId, target)).userId).toBeTruthy();
  });
  it('commits five failed attempts and prevents resend resetting the budget', async () => {
    const target = email(),
      c = await login(target);
    const wrong = codes.get(target) === '000000' ? '111111' : '000000';
    for (let attempt = 0; attempt < 5; attempt++)
      await expect(
        otpService.verifyOtp(
          { challengeId: c.challengeId, code: wrong },
          binding,
          'email-otp-test',
        ),
      ).rejects.toMatchObject({ code: 'INVALID_OTP' });
    await expect(verify(c.challengeId, target)).rejects.toMatchObject({ code: 'INVALID_OTP' });
    await transaction.withTransaction((db) =>
      db.query(
        "UPDATE otp_challenges SET created_at=CURRENT_TIMESTAMP - INTERVAL '61 seconds' WHERE challenge_id=$1",
        [Buffer.from(c.challengeId, 'base64url')],
      ),
    );
    await expect(login(target)).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED' });
  });
  it('rejects expired OTP and an alias that has never been registered', async () => {
    const target = email(),
      c = await login(target);
    await transaction.withTransaction((db) =>
      db.query(
        "UPDATE otp_challenges SET created_at=CURRENT_TIMESTAMP - INTERVAL '6 minutes',expires_at=CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE challenge_id=$1",
        [Buffer.from(c.challengeId, 'base64url')],
      ),
    );
    await expect(verify(c.challengeId, target)).rejects.toMatchObject({ code: 'INVALID_OTP' });
    const unknownPhone = '+19999999999';
    emails.push(unknownPhone);
    const unknown = await login(unknownPhone);
    expect(unknown).toHaveProperty('challengeId');
    await expect(
      otpService.verifyOtp(
        { challengeId: unknown.challengeId, code: '123456' },
        binding,
        'email-otp-test',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });
  it('revokes a challenge when the email adapter fails', async () => {
    const target = email();
    vi.spyOn(delivery.emailDelivery, 'send').mockRejectedValue(
      new Error('mock transport unavailable'),
    );
    await expect(login(target)).rejects.toThrow();
    const result = await transaction.withTransaction((db) =>
      db.query<{ delivery_ready: boolean; revoked: boolean }>(
        'SELECT delivery_ready,revoked_at IS NOT NULL AS revoked FROM otp_challenges WHERE target_canonical=$1',
        [target],
      ),
    );
    expect(result.rows[0]).toEqual({ delivery_ready: false, revoked: true });
  });
  it('blocks duplicate Google email then links EMAIL and phone to the original User', async () => {
    const target = email(),
      original = await google(target);
    const c = await login(target);
    await expect(verify(c.challengeId, target)).rejects.toMatchObject({ code: 'LINK_REQUIRED' });
    const header = `Bearer ${await auth.accessToken(original)}`;
    await transaction.withTransaction((db) =>
      db.query(
        "UPDATE otp_challenges SET created_at=CURRENT_TIMESTAMP - INTERVAL '61 seconds' WHERE challenge_id=$1",
        [Buffer.from(c.challengeId, 'base64url')],
      ),
    );
    const linked = await otpService.requestOtp(
      { identifier: target, purpose: 'LINK_IDENTITY', phone: '+84123456789' },
      binding,
      header,
    );
    expect((await verify(linked.challengeId, target, header)).userId).toBe(original.userId);
  });
  it('links Google to an existing EMAIL User without auto merging on a plain Google login', async () => {
    const target = email(),
      c = await login(target),
      original = await verify(c.challengeId, target);
    await expect(google(target)).rejects.toMatchObject({ code: 'LINK_REQUIRED' });
    const header = `Bearer ${await auth.accessToken(original)}`;
    expect((await google(target, await auth.linkingActor(header))).userId).toBe(original.userId);
  });
  it('requires recent authentication and the same email for linking', async () => {
    const target = email(),
      original = await google(target),
      header = `Bearer ${await auth.accessToken(original)}`;
    await expect(
      otpService.requestOtp({ identifier: email(), purpose: 'LINK_IDENTITY' }, binding, header),
    ).rejects.toMatchObject({ code: 'EMAIL_MISMATCH' });
    await transaction.withTransaction((db) =>
      db.query(
        "UPDATE auth_sessions SET authenticated_at=CURRENT_TIMESTAMP - INTERVAL '6 minutes' WHERE id=$1",
        [original.sessionId],
      ),
    );
    await expect(auth.linkingActor(header)).rejects.toMatchObject({
      code: 'REAUTHENTICATION_REQUIRED',
    });
  });
  it('never transfers a phone alias or keeps a new User after alias conflict', async () => {
    const firstEmail = email(),
      secondEmail = email(),
      phone = '+84111111111';
    const first = await login(firstEmail, phone);
    const owner = await verify(first.challengeId, firstEmail);
    const second = await login(secondEmail, phone);
    await expect(verify(second.challengeId, secondEmail)).rejects.toMatchObject({
      code: 'PHONE_CONFLICT',
    });
    const result = await transaction.withTransaction((db) =>
      db.query<{ user_id: string }>(
        'SELECT i.user_id::text FROM phone_login_aliases a JOIN external_identities i ON i.id=a.email_identity_id WHERE a.phone=$1',
        [phone],
      ),
    );
    expect(result.rows[0]!.user_id).toBe(owner.userId);
    const duplicate = await transaction.withTransaction((db) =>
      db.query('SELECT id FROM external_identities WHERE subject=$1', [secondEmail]),
    );
    expect(duplicate.rowCount).toBe(0);
  });
  it('rejects linking legacy identities already belonging to different Users', async () => {
    const target = email(),
      original = await google(target);
    const { authRepository } = await import('../src/modules/auth/auth.repository.js');
    await transaction.withTransaction(async (db) => {
      const other = await authRepository.createEmailUser(db);
      await authRepository.addEmailIdentity(db, other.userId, target);
    });
    const header = `Bearer ${await auth.accessToken(original)}`;
    const c = await otpService.requestOtp(
      { identifier: target, purpose: 'LINK_IDENTITY' },
      binding,
      header,
    );
    await expect(verify(c.challengeId, target, header)).rejects.toMatchObject({
      code: 'IDENTITY_CONFLICT',
    });
  });
  it('returns only the current User methods and denies metadata after logout', async () => {
    const target = email(),
      c = await login(target),
      session = await verify(c.challengeId, target);
    const header = `Bearer ${await auth.accessToken(session)}`;
    const metadata = await auth.currentMethods(header);
    expect(metadata).toEqual({ email: target, googleLinked: false, emailLinked: true, phones: [] });
    await auth.logout(session.refreshToken, 'email-otp-test');
    await expect(auth.currentMethods(header)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
