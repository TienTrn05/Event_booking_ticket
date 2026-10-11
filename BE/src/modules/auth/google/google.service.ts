import { CodeChallengeMethod } from 'google-auth-library';
import { z } from 'zod';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { authRepository } from '../auth.repository.js';
import { createSession } from '../session/session.service.js';
import { config, stateTtl } from '../shared/auth.config.js';
import { b64, equal, hash, random, signState } from '../shared/auth.crypto.js';
import type { Account } from '../shared/auth.types.js';
const signedState = z.object({
  state: z.string(),
  verifier: z.string(),
  nonce: z.string(),
  expires: z.number(),
  link: z.object({ userId: z.string(), sessionId: z.string(), email: z.string() }).optional(),
});

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
  let subject: string;
  let name: string;
  let email: string | null;
  let emailVerified: boolean;
  let hd: string | null;
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
