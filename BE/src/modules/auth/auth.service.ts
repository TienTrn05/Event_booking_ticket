import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { CodeChallengeMethod, OAuth2Client } from 'google-auth-library';
import { SignJWT, jwtVerify } from 'jose';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { withConnection } from '../../shared/database/pool.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authRepository } from './auth.repository.js';

const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET ?? '');
const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI
    ? new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI)
    : null;
export const sessionEnabled = Boolean(env.PUBLIC_APP_URL && secret.length >= 32);
export const authEnabled = Boolean(google && sessionEnabled);
const day = 24 * 60 * 60 * 1000;
const stateTtl = 5 * 60 * 1000;
const random = () => randomBytes(32).toString('base64url');
const hash = (value: string) => createHash('sha256').update(value).digest();
const b64 = (value: Buffer) => value.toString('base64url');
const signedState = z.object({
  state: z.string(),
  verifier: z.string(),
  nonce: z.string(),
  expires: z.number(),
  link: z.object({ userId: z.string(), sessionId: z.string(), email: z.string() }).optional(),
});

function config() {
  if (
    !authEnabled ||
    !google ||
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_REDIRECT_URI ||
    !env.PUBLIC_APP_URL
  ) {
    throw new AppError(503, 'AUTH_UNAVAILABLE', 'Đăng nhập Google chưa được cấu hình.');
  }
  return {
    google,
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    appUrl: env.PUBLIC_APP_URL,
  };
}

function signState(value: string) {
  return b64(createHmac('sha256', secret).update(value).digest());
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function startGoogle(link?: { userId: string; sessionId: string; email: string }) {
  const { google: client, redirectUri } = config();
  const state = random();
  const verifier = random();
  const nonce = random();
  const challenge = b64(hash(verifier));
  const data = Buffer.from(
    JSON.stringify({ state, verifier, nonce, expires: Date.now() + stateTtl, link }),
  ).toString('base64url');
  const url = client.generateAuthUrl({
    response_type: 'code',
    scope: ['openid', 'email', 'profile'],
    redirect_uri: redirectUri,
    access_type: 'online',
    state,
    code_challenge: challenge,
    code_challenge_method: CodeChallengeMethod.S256,
    nonce,
    prompt: 'select_account',
  });
  return { url, stateCookie: `${data}.${signState(data)}` };
}

export interface Account {
  userId: string;
  identityId: string;
  displayName: string;
  authVersion: number;
}
export interface Session extends Account {
  sessionId: string;
  expiresAt: Date;
  refreshToken: string;
}

export async function createSession(
  connection: PoolClient,
  account: Account,
  requestId: string,
  action = 'auth.google.login',
): Promise<Session> {
  const family = randomBytes(32);
  const refreshToken = random();
  const row = await authRepository.createSession(
    connection,
    account.userId,
    account.identityId,
    family,
  );
  await authRepository.createRefresh(connection, row.id, hash(refreshToken), row.expiresAt);
  await authRepository.audit(connection, account.userId, action, row.id, requestId);
  return { ...account, sessionId: row.id, expiresAt: row.expiresAt, refreshToken };
}

export async function finishGoogle(
  code: string,
  returnedState: string,
  stateCookie: string | undefined,
  requestId: string,
) {
  const { google: client, clientId } = config();
  if (!stateCookie || stateCookie.length > 1500)
    throw new AppError(401, 'INVALID_OAUTH_STATE', 'Phiên đăng nhập đã hết hạn.');
  const [data, signature, extra] = stateCookie.split('.');
  if (!data || !signature || extra || !equal(signState(data), signature)) {
    throw new AppError(401, 'INVALID_OAUTH_STATE', 'Phiên đăng nhập đã hết hạn.');
  }
  let state: z.infer<typeof signedState>;
  try {
    state = signedState.parse(JSON.parse(Buffer.from(data, 'base64url').toString('utf8')));
  } catch {
    throw new AppError(401, 'INVALID_OAUTH_STATE', 'Phiên đăng nhập đã hết hạn.');
  }
  if (state.expires < Date.now() || !equal(state.state, returnedState)) {
    throw new AppError(401, 'INVALID_OAUTH_STATE', 'Phiên đăng nhập đã hết hạn.');
  }
  let idToken: string | undefined;
  try {
    const result = await client.getToken({ code, codeVerifier: state.verifier });
    idToken = result.tokens.id_token ?? undefined;
  } catch {
    throw new AppError(503, 'GOOGLE_UNAVAILABLE', 'Không thể xác thực với Google.');
  }
  if (!idToken) throw new AppError(401, 'INVALID_GOOGLE_PROOF', 'Không thể xác thực với Google.');
  let subject: string,
    name: string,
    email: string | null,
    emailVerified: boolean,
    hd: string | null;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const claims = ticket.getPayload();
    if (!claims?.sub || claims.nonce !== state.nonce) throw new Error('Invalid identity claims');
    subject = claims.sub;
    name = (claims.name || 'Người dùng Google').trim().slice(0, 120);
    email = claims.email?.toLowerCase() ?? null;
    emailVerified = claims.email_verified === true;
    hd = claims.hd ?? null;
  } catch {
    throw new AppError(401, 'INVALID_GOOGLE_PROOF', 'Không thể xác thực với Google.');
  }
  return withTransaction(async (connection) => {
    if (email) await authRepository.lockEmail(connection, email);
    await authRepository.lockGoogleSubject(connection, subject);
    const existing = await authRepository.googleIdentity(connection, subject);
    if (state.link) {
      const actor = await authRepository.linkActor(
        connection,
        state.link.userId,
        state.link.sessionId,
      );
      if (
        !actor ||
        !actor.recent ||
        actor.provider !== 'EMAIL' ||
        !emailVerified ||
        email !== actor.email ||
        email !== state.link.email
      ) {
        throw new AppError(
          401,
          'REAUTHENTICATION_REQUIRED',
          'Đăng nhập lại bằng email trước khi liên kết Google.',
        );
      }
      if (existing && existing.user_id !== actor.id)
        throw new AppError(409, 'IDENTITY_CONFLICT', 'Google đã thuộc tài khoản khác.');
      if (!existing)
        await authRepository.addGoogleIdentity(connection, actor.id, subject, email!, hd);
      await authRepository.audit(
        connection,
        actor.id,
        'auth.google.link',
        state.link.sessionId,
        requestId,
      );
      const identity = await authRepository.googleIdentity(connection, subject);
      if (!identity || identity.revoked_at || identity.status !== 'ACTIVE')
        throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản không khả dụng.');
      return createSession(
        connection,
        {
          userId: actor.id,
          identityId: identity.identity_id,
          displayName: actor.display_name,
          authVersion: actor.auth_version,
        },
        requestId,
      );
    }
    let account: Account;
    if (existing) {
      const row = existing;
      if (row.status !== 'ACTIVE' || row.revoked_at)
        throw new AppError(403, 'ACCOUNT_DISABLED', 'Tài khoản không khả dụng.');
      account = {
        userId: row.user_id,
        identityId: row.identity_id,
        displayName: row.display_name,
        authVersion: row.auth_version,
      };
      await authRepository.updateGoogleIdentity(
        connection,
        account.identityId,
        email,
        emailVerified,
        hd,
      );
    } else {
      if (email && (await authRepository.emailAccount(connection, email))) {
        throw new AppError(
          409,
          'LINK_REQUIRED',
          'Đăng nhập bằng email rồi liên kết Google trong tài khoản.',
        );
      }
      if (email && (await authRepository.googleEmailOwners(connection, email)).length)
        throw new AppError(409, 'IDENTITY_CONFLICT', 'Email đã thuộc tài khoản Google khác.');
      const created = await authRepository.createGoogleAccount(
        connection,
        subject,
        name || 'Người dùng Google',
        email,
        emailVerified,
        hd,
      );
      if (!created.roleAdded)
        throw new AppError(503, 'AUTH_UNAVAILABLE', 'Chưa nạp dữ liệu quyền.');
      account = {
        userId: created.userId,
        identityId: created.identityId,
        displayName: name,
        authVersion: 0,
      };
    }
    return createSession(connection, account, requestId);
  });
}

export async function accessToken(account: Session) {
  return new SignJWT({ sid: account.sessionId, authVersion: account.authVersion })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(account.userId)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setJti(random())
    .setExpirationTime('10m')
    .sign(secret);
}

export async function rotateRefresh(token: string, requestId: string): Promise<Session> {
  requireSessionConfig();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.');
  return withTransaction(async (connection) => {
    const row = await authRepository.refreshByHash(connection, hash(token));
    if (!row) throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.');
    await authRepository.lockSession(connection, row.session_id);
    const current = await authRepository.lockedRefresh(connection, row.id);
    if (!current) throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.');
    if (current.used_at) {
      await authRepository.revokeSession(connection, current.session_id);
      await authRepository.audit(
        connection,
        current.user_id,
        'auth.refresh.reuse',
        current.session_id,
        requestId,
      );
      return { reused: true as const };
    }
    if (
      current.revoked_at ||
      current.session_revoked_at ||
      current.status !== 'ACTIVE' ||
      !current.token_active ||
      !current.session_active ||
      !current.identity_active
    ) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.');
    }
    const next = random();
    await authRepository.markRefreshUsed(connection, current.id);
    await authRepository.createRefresh(
      connection,
      current.session_id,
      hash(next),
      current.session_expires_at,
      current.id,
    );
    return {
      reused: false as const,
      session: {
        userId: current.user_id,
        identityId: current.identity_id,
        displayName: current.display_name,
        authVersion: current.auth_version,
        sessionId: current.session_id,
        expiresAt: current.session_expires_at,
        refreshToken: next,
      },
    };
  }).then((result) => {
    if (result.reused) throw new AppError(401, 'REFRESH_REUSED', 'Phiên đăng nhập đã bị thu hồi.');
    return result.session;
  });
}

async function authenticatedUser(header: string | undefined) {
  requireSessionConfig();
  if (!header?.startsWith('Bearer ')) throw new AppError(401, 'UNAUTHENTICATED', 'Cần đăng nhập.');
  let claims: { sub?: string; sid?: unknown; authVersion?: unknown };
  try {
    const verified = await jwtVerify(header.slice(7), secret, {
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      algorithms: ['HS256'],
    });
    claims = verified.payload;
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.');
  }
  if (
    !/^\d+$/.test(claims.sub ?? '') ||
    typeof claims.sid !== 'string' ||
    !/^\d+$/.test(claims.sid) ||
    typeof claims.authVersion !== 'number'
  ) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.');
  }
  return withConnection(async (connection) => {
    const user = await authRepository.currentUser(connection, claims.sub!, claims.sid as string);
    if (!user || user.auth_version !== claims.authVersion)
      throw new AppError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập không hợp lệ.');
    return { id: user.id, displayName: user.display_name, sessionId: claims.sid as string };
  });
}

export async function currentUser(header: string | undefined) {
  const user = await authenticatedUser(header);
  return { id: user.id, displayName: user.displayName };
}

export async function currentMethods(header: string | undefined) {
  const user = await authenticatedUser(header);
  return withConnection((db) => authRepository.loginMethods(db, user.id));
}

function requireSessionConfig() {
  if (!sessionEnabled) throw new AppError(503, 'AUTH_UNAVAILABLE', 'Đăng nhập chưa được cấu hình.');
}

export async function linkingActor(header: string | undefined) {
  const user = await authenticatedUser(header);
  return withConnection(async (db) => {
    const actor = await authRepository.linkActor(db, user.id, user.sessionId);
    if (!actor || !actor.recent || !actor.email || !['GOOGLE', 'EMAIL'].includes(actor.provider)) {
      throw new AppError(
        401,
        'REAUTHENTICATION_REQUIRED',
        'Đăng nhập lại trước khi liên kết phương thức.',
      );
    }
    return { userId: actor.id, sessionId: user.sessionId, email: actor.email };
  });
}

export async function logout(token: string | undefined, requestId: string) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await withTransaction(async (connection) => {
    const row = await authRepository.refreshByHash(connection, hash(token));
    if (!row) return;
    await authRepository.revokeSession(connection, row.session_id);
    await authRepository.audit(connection, row.user_id, 'auth.logout', row.session_id, requestId);
  });
}

export async function recordGoogleFailure(
  requestId: string,
  error: unknown,
  action = 'auth.google.failure',
) {
  const code = error instanceof AppError ? error.code : 'AUTH_ERROR';
  try {
    await withConnection((connection) =>
      authRepository.auditFailure(connection, requestId, code, action),
    );
  } catch {
    // The login failure remains a failure when the database is unavailable.
  }
}

export function authCookieOptions() {
  const secure = env.APP_ENV !== 'development' && env.APP_ENV !== 'testing';
  return { secure, sameSite: 'lax' as const };
}
export const authStateMaxAge = stateTtl;
export const refreshMaxAge = 7 * day;
export function appReturnUrl(result: 'success' | 'error', reason?: string) {
  const { appUrl } = config();
  const url = new URL(appUrl);
  url.searchParams.set('auth', result);
  if (
    reason &&
    [
      'LINK_REQUIRED',
      'IDENTITY_CONFLICT',
      'REAUTHENTICATION_REQUIRED',
      'ACCOUNT_DISABLED',
      'INVALID_OAUTH_STATE',
      'GOOGLE_CANCELLED',
      'GOOGLE_UNAVAILABLE',
    ].includes(reason)
  )
    url.searchParams.set('authReason', reason);
  return url.toString();
}
