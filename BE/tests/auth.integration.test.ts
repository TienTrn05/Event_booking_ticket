import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { LoginTicket } from 'google-auth-library';
import { decodeJwt } from 'jose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Session } from '../src/modules/auth/shared/auth.types.js';
import type * as DatabaseModule from '../src/shared/database/pool.js';
import type * as OtpModule from '../src/modules/auth/otp/otp.service.js';
import type * as GoogleModule from '../src/modules/auth/google/google.service.js';
import type * as SessionModule from '../src/modules/auth/session/session.service.js';
import type * as TransactionModule from '../src/shared/database/transaction.js';
import type * as DeliveryModule from '../src/modules/auth/otp/email/email-delivery.js';
import type * as ConfigModule from '../src/modules/auth/shared/auth.config.js';
import type * as AppModule from '../src/app.js';

describe.skipIf(!process.env.COMMERCE_TEST_DB_PORT)('authentication on isolated PostgreSQL', () => {
  let db: typeof DatabaseModule;
  let otp: typeof OtpModule;
  let google: typeof GoogleModule;
  let sessions: typeof SessionModule;
  let transactions: typeof TransactionModule;
  let delivery: typeof DeliveryModule;
  let config: typeof ConfigModule;
  let app: ReturnType<typeof AppModule.createApp>;
  const sent = new Map<string, string>();
  const email = () => randomUUID() + '@fixture.invalid';
  const binding = () => randomBytes(32).toString('base64url');
  const challenge = (
    identifier: string,
    browser: string,
    purpose: 'LOGIN' | 'LINK_IDENTITY' = 'LOGIN',
    header?: string,
  ) => otp.requestOtp({ identifier, purpose }, browser, header);
  const verify = (id: string, code: string, browser: string, header?: string) =>
    otp.verifyOtp({ challengeId: id, code }, browser, randomUUID(), header);
  async function emailLogin(target = email()) {
    const browser = binding(),
      pending = await challenge(target, browser);
    return verify(pending.challengeId, sent.get(target)!, browser);
  }
  async function googleLogin(
    target: string,
    subject = randomUUID(),
    link?: { userId: string; sessionId: string; email: string },
  ) {
    const start = google.startGoogle(link),
      params = new URL(start.url).searchParams;
    const client = config.config().google;
    vi.spyOn(client, 'getToken').mockImplementation(async () => ({
      tokens: { id_token: 'fixture-proof' },
      res: null,
    }));
    vi.spyOn(client, 'verifyIdToken').mockImplementation(
      async () =>
        new LoginTicket('fixture', {
          iss: 'https://accounts.google.com',
          aud: 'fixture.apps.googleusercontent.com',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 300,
          sub: subject,
          email: target,
          email_verified: true,
          nonce: params.get('nonce')!,
          name: 'Google fixture',
        }),
    );
    return google.finishGoogle(
      'fixture-code',
      params.get('state')!,
      start.stateCookie,
      randomUUID(),
    );
  }
  beforeAll(async () => {
    Object.assign(process.env, {
      OTP_HMAC_KEY: 'd'.repeat(64),
      SMTP_USER: 'fixture@gmail.com',
      SMTP_PASSWORD: 'fixture-only',
      GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'fixture-only',
      GOOGLE_REDIRECT_URI: `http://127.0.0.1:${process.env.COMMERCE_TEST_APP_PORT ?? '5173'}/api/v1/auth/google/callback`,
    });
    db = await import('../src/shared/database/pool.js');
    otp = await import('../src/modules/auth/otp/otp.service.js');
    google = await import('../src/modules/auth/google/google.service.js');
    sessions = await import('../src/modules/auth/session/session.service.js');
    transactions = await import('../src/shared/database/transaction.js');
    delivery = await import('../src/modules/auth/otp/email/email-delivery.js');
    config = await import('../src/modules/auth/shared/auth.config.js');
    const { createApp } = await import('../src/app.js');
    app = createApp({ checkDatabase: db.checkDatabase, logRequest: () => {} });
  });
  // restoreMocks runs before every test, so install the sink separately for each case.
  function sink() {
    return vi.spyOn(delivery.emailDelivery, 'send').mockImplementation(async (to, code) => {
      sent.set(to, code);
    });
  }
  afterAll(async () => {
    if (db) await db.pool.end();
  });

  it('consumes an OTP once under concurrency and creates no role before onboarding', async () => {
    sink();
    const target = email(),
      browser = binding(),
      pending = await challenge(target, browser);
    const row = (
      await db.pool.query(
        'SELECT code_mac,browser_binding_hash,delivery_ready FROM otp_challenges WHERE challenge_id=$1',
        [Buffer.from(pending.challengeId, 'base64url')],
      )
    ).rows[0];
    expect(row.delivery_ready).toBe(true);
    expect(row.code_mac).toHaveLength(32);
    expect(row.browser_binding_hash).toHaveLength(32);
    const results = await Promise.allSettled([
      verify(pending.challengeId, sent.get(target)!, browser),
      verify(pending.challengeId, sent.get(target)!, browser),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const session = results.find(
      (r): r is PromiseFulfilledResult<Session> => r.status === 'fulfilled',
    )!.value;
    expect(
      (await db.pool.query('SELECT role_id FROM user_roles WHERE user_id=$1', [session.userId]))
        .rowCount,
    ).toBe(0);
    await expect(verify(pending.challengeId, sent.get(target)!, browser)).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
    const token = decodeJwt(await sessions.accessToken(session));
    expect(token.exp! - token.iat!).toBe(600);
  });

  it('persists wrong attempts across resend, binds the browser and rate limits replacement challenges', async () => {
    sink();
    const target = email(),
      browser = binding(),
      first = await challenge(target, browser);
    const wrong = sent.get(target) === '000000' ? '000001' : '000000';
    await expect(verify(first.challengeId, sent.get(target)!, binding())).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
    for (let i = 0; i < 3; i++)
      await expect(verify(first.challengeId, wrong, browser)).rejects.toMatchObject({
        code: 'INVALID_OTP',
      });
    expect(
      (
        await db.pool.query('SELECT attempts FROM otp_challenges WHERE challenge_id=$1', [
          Buffer.from(first.challengeId, 'base64url'),
        ])
      ).rows[0].attempts,
    ).toBe(3);
    await expect(challenge(target, browser)).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED' });
    await db.pool.query(
      "UPDATE otp_challenges SET created_at=clock_timestamp()-interval '61 seconds' WHERE challenge_id=$1",
      [Buffer.from(first.challengeId, 'base64url')],
    );
    const second = await challenge(target, browser);
    await expect(verify(first.challengeId, sent.get(target)!, browser)).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
    const nextWrong = sent.get(target) === '000000' ? '000001' : '000000';
    for (let i = 0; i < 2; i++)
      await expect(verify(second.challengeId, nextWrong, browser)).rejects.toMatchObject({
        code: 'INVALID_OTP',
      });
    await expect(verify(second.challengeId, sent.get(target)!, browser)).rejects.toMatchObject({
      code: 'INVALID_OTP',
    });
    await db.pool.query(
      "UPDATE otp_challenges SET created_at=clock_timestamp()-interval '61 seconds' WHERE challenge_id=$1",
      [Buffer.from(second.challengeId, 'base64url')],
    );
    await expect(challenge(target, browser)).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED' });
  });

  it('rechecks expiry after waiting for the target lock', async () => {
    sink();
    const target = email(),
      browser = binding(),
      pending = await challenge(target, browser);
    const repository = (await import('../src/modules/auth/otp/otp.repository.js')).otpRepository;
    const blocker = await db.pool.connect();
    let attempted!: () => void;
    const entered = new Promise<void>((done) => {
      attempted = done;
    });
    const original = repository.lockTarget;
    vi.spyOn(repository, 'lockTarget').mockImplementation(async (connection, value) => {
      attempted();
      return original(connection, value);
    });
    await blocker.query('BEGIN');
    await original(blocker, target);
    const verification = verify(pending.challengeId, sent.get(target)!, browser);
    // Observe the rejection immediately so a failed assertion cannot leak a pending promise.
    const outcome = verification.then(
      (value) => ({ value, error: undefined }),
      (error: unknown) => ({ value: undefined, error }),
    );
    try {
      await entered;
      await blocker.query(
        'UPDATE otp_challenges SET expires_at=clock_timestamp() WHERE challenge_id=$1',
        [Buffer.from(pending.challengeId, 'base64url')],
      );
      await blocker.query('COMMIT');
      expect((await outcome).error).toMatchObject({ code: 'INVALID_OTP' });
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await outcome;
    }
  });

  it('never verifies an undelivered code and revokes a failed delivery', async () => {
    const target = email(),
      browser = binding();
    let resume!: () => void;
    const gate = new Promise<void>((done) => {
      resume = done;
    });
    const mock = sink().mockImplementationOnce(async (to, code) => {
      sent.set(to, code);
      await gate;
      throw new Error('Fixture delivery failed');
    });
    const pending = challenge(target, browser).then(
      () => undefined,
      (error: unknown) => error,
    );
    let row: { challenge_id: Buffer } | undefined;
    try {
      await vi.waitFor(async () => {
        row = (
          await db.pool.query('SELECT challenge_id FROM otp_challenges WHERE target_canonical=$1', [
            target,
          ])
        ).rows[0];
        expect(mock).toHaveBeenCalled();
        expect(row).toBeDefined();
      });
      await expect(
        verify(row!.challenge_id.toString('base64url'), sent.get(target)!, browser),
      ).rejects.toMatchObject({ code: 'INVALID_OTP' });
    } finally {
      resume();
      await pending;
    }
    const stored = (
      await db.pool.query(
        'SELECT delivery_ready,revoked_at FROM otp_challenges WHERE target_canonical=$1',
        [target],
      )
    ).rows[0];
    expect(stored.delivery_ready).toBe(false);
    expect(stored.revoked_at).not.toBeNull();
  });

  it('does not merge Google and email by matching address and links only with recent explicit proof', async () => {
    sink();
    const target = email(),
      subject = randomUUID(),
      original = await googleLogin(target, subject);
    expect(
      (await db.pool.query('SELECT role_id FROM user_roles WHERE user_id=$1', [original.userId]))
        .rowCount,
    ).toBe(0);
    const browser = binding(),
      login = await challenge(target, browser);
    await expect(verify(login.challengeId, sent.get(target)!, browser)).rejects.toMatchObject({
      code: 'LINK_REQUIRED',
    });
    await db.pool.query(
      "UPDATE otp_challenges SET created_at=clock_timestamp()-interval '61 seconds' WHERE challenge_id=$1",
      [Buffer.from(login.challengeId, 'base64url')],
    );
    const header = 'Bearer ' + (await sessions.accessToken(original));
    await expect(challenge(email(), browser, 'LINK_IDENTITY', header)).rejects.toMatchObject({
      code: 'EMAIL_MISMATCH',
    });
    const link = await challenge(target, browser, 'LINK_IDENTITY', header);
    const linked = await verify(link.challengeId, sent.get(target)!, browser, header);
    expect(linked.userId).toBe(original.userId);
    expect(
      (
        await db.pool.query(
          'SELECT provider FROM external_identities WHERE user_id=$1 ORDER BY provider',
          [original.userId],
        )
      ).rows.map((r) => r.provider),
    ).toEqual(['EMAIL', 'GOOGLE']);
    await db.pool.query(
      "UPDATE auth_sessions SET authenticated_at=clock_timestamp()-interval '6 minutes' WHERE id=$1",
      [original.sessionId],
    );
    await expect(challenge(target, browser, 'LINK_IDENTITY', header)).rejects.toMatchObject({
      code: 'REAUTHENTICATION_REQUIRED',
    });
    const emailSession = await emailLogin();
    await expect(
      googleLogin(target, subject, {
        userId: emailSession.userId,
        sessionId: emailSession.sessionId,
        email: target,
      }),
    ).rejects.toMatchObject({ code: 'REAUTHENTICATION_REQUIRED' });
  });

  it('validates OAuth state/PKCE/nonce and requires explicit linking from an existing email account', async () => {
    sink();
    const target = email(),
      original = await emailLogin(target);
    const start = google.startGoogle(),
      params = new URL(start.url).searchParams;
    const state = JSON.parse(
      Buffer.from(start.stateCookie.split('.')[0]!, 'base64url').toString('utf8'),
    ) as { verifier: string };
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBe(
      createHash('sha256').update(state.verifier).digest('base64url'),
    );
    await expect(
      google.finishGoogle('fixture', 'wrong-state', start.stateCookie, randomUUID()),
    ).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
    await expect(
      google.finishGoogle(
        'fixture',
        params.get('state')!,
        start.stateCookie + 'tampered',
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_OAUTH_STATE' });
    const subject = randomUUID();
    await expect(googleLogin(target, subject)).rejects.toMatchObject({ code: 'LINK_REQUIRED' });
    const linked = await googleLogin(target, subject, {
      userId: original.userId,
      sessionId: original.sessionId,
      email: target,
    });
    expect(linked.userId).toBe(original.userId);
    // A verified provider token with a nonce from another login is still invalid.
    const fresh = google.startGoogle();
    await expect(
      google.finishGoogle(
        'fixture',
        new URL(fresh.url).searchParams.get('state')!,
        fresh.stateCookie,
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_GOOGLE_PROOF' });
  });

  it('rotates without extending absolute expiry and revokes only the reused refresh family', async () => {
    sink();
    const first = await emailLogin();
    const other = await transactions.withTransaction((connection) =>
      sessions.createSession(connection, first, randomUUID()),
    );
    const deadline = (
      await db.pool.query(
        "UPDATE auth_sessions SET expires_at=clock_timestamp()+interval '2 days' WHERE id=$1 RETURNING expires_at",
        [first.sessionId],
      )
    ).rows[0].expires_at as Date;
    const next = await sessions.rotateRefresh(first.refreshToken, randomUUID());
    expect(next.refreshToken).not.toBe(first.refreshToken);
    expect(next.expiresAt).toEqual(deadline);
    await expect(sessions.rotateRefresh(first.refreshToken, randomUUID())).rejects.toMatchObject({
      code: 'REFRESH_REUSED',
    });
    await expect(sessions.rotateRefresh(next.refreshToken, randomUUID())).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(
      sessions.authenticatedUser('Bearer ' + (await sessions.accessToken(first))),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect((await sessions.rotateRefresh(other.refreshToken, randomUUID())).userId).toBe(
      first.userId,
    );
  });

  it.each(['session', 'token'] as const)(
    'rejects refresh when the %s expires while waiting for the user lock',
    async (expiry) => {
      sink();
      const session = await emailLogin();
      const repository = (await import('../src/modules/auth/auth.repository.js')).authRepository;
      const blocker = await db.pool.connect();
      let attempted!: () => void;
      const entered = new Promise<void>((done) => {
        attempted = done;
      });
      const original = repository.lockUser;
      vi.spyOn(repository, 'lockUser').mockImplementation(async (connection, id) => {
        attempted();
        return original(connection, id);
      });
      await blocker.query('BEGIN');
      await original(blocker, session.userId);
      const outcome = sessions.rotateRefresh(session.refreshToken, randomUUID()).then(
        () => undefined,
        (error: unknown) => error,
      );
      try {
        await entered;
        if (expiry === 'session')
          await blocker.query('UPDATE auth_sessions SET expires_at=clock_timestamp() WHERE id=$1', [
            session.sessionId,
          ]);
        else
          await blocker.query(
            'UPDATE refresh_tokens SET expires_at=clock_timestamp() WHERE session_id=$1',
            [session.sessionId],
          );
        await blocker.query('COMMIT');
        expect(await outcome).toMatchObject({ code: 'UNAUTHENTICATED' });
        expect(
          (
            await db.pool.query(
              'SELECT count(*)::int AS n FROM refresh_tokens WHERE session_id=$1',
              [session.sessionId],
            )
          ).rows[0].n,
        ).toBe(1);
      } finally {
        await blocker.query('ROLLBACK');
        blocker.release();
        await outcome;
      }
    },
  );

  it('rechecks profile expiry after acquiring the user and session locks', async () => {
    sink();
    const session = await emailLogin();
    const { usersRepository } =
      await import('../src/modules/users/repositories/users.repository.js');
    const blocker = await db.pool.connect();
    let entered!: () => void;
    const started = new Promise<void>((done) => {
      entered = done;
    });
    await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [session.userId]);
    const outcome = transactions
      .withTransaction(async (connection) => {
        entered();
        return usersRepository.profile(
          connection,
          { id: session.userId, sessionId: session.sessionId, authVersion: session.authVersion },
          true,
        );
      })
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    try {
      await started;
      await blocker.query('UPDATE auth_sessions SET expires_at=clock_timestamp() WHERE id=$1', [
        session.sessionId,
      ]);
      await blocker.query('COMMIT');
      expect(await outcome).toMatchObject({ code: 'UNAUTHENTICATED' });
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      await outcome;
    }
  });

  it('protects OTP HTTP with Origin/CSRF, uniform unknown-phone responses and private cookies', async () => {
    const mock = sink(),
      target = email();
    const headers = {
      Origin: 'http://127.0.0.1:62137',
      Cookie: 'eventix.csrf=fixture',
      'X-CSRF-Token': 'fixture',
    };
    expect(
      (await request(app).post('/api/v1/auth/otp/request').send({ identifier: target })).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/otp/request')
          .set({ ...headers, Origin: 'https://foreign.invalid' })
          .send({ identifier: target })
      ).status,
    ).toBe(403);
    const unknown = await request(app)
      .post('/api/v1/auth/otp/request')
      .set(headers)
      .send({ identifier: '+84987654321' });
    expect(unknown.status).toBe(202);
    expect(unknown.body.data).toMatchObject({ expiresIn: 300, resendAfter: 60 });
    expect(mock).not.toHaveBeenCalled();
    const response = await request(app)
      .post('/api/v1/auth/otp/request')
      .set(headers)
      .send({ identifier: target });
    expect(response.status).toBe(202);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringMatching(/eventix\.otp-browser=.*HttpOnly/)]),
    );
    expect(JSON.stringify(response.body)).not.toContain(sent.get(target));
    expect(JSON.stringify(response.body)).not.toContain(target);
  });
});
