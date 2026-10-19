import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { env } from '../../../config/env.js';
import { withConnection } from '../../../shared/database/pool.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { authRepository } from '../auth.repository.js';
import { requireSessionConfig, secret } from '../shared/auth.config.js';
import { hash, random } from '../shared/auth.crypto.js';
import type { Account, Session } from '../shared/auth.types.js';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { usersRepository } from '../../users/repositories/users.repository.js';
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
    await authRepository.lockUser(connection, row.user_id);
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

export async function authenticatedUser(header: string | undefined) {
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
    return {
      id: user.id,
      displayName: user.display_name,
      sessionId: claims.sid as string,
      authVersion: user.auth_version,
    };
  });
}

export async function logout(token: string | undefined, requestId: string) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await withTransaction(async (connection) => {
    const row = await authRepository.refreshByHash(connection, hash(token));
    if (!row) return;
    await authRepository.lockUser(connection, row.user_id);
    await authRepository.revokeSession(connection, row.session_id);
    await authRepository.audit(connection, row.user_id, 'auth.logout', row.session_id, requestId);
  });
}

export async function listSessions(actor: RequestActor, page: number, pageSize: number) {
  return withTransaction(async (db) => {
    await authRepository.lockUser(db, actor.id);
    await usersRepository.profile(db, actor, true);
    const result = await authRepository.listSessions(
      db,
      actor.id,
      actor.sessionId,
      pageSize,
      (page - 1) * pageSize,
    );
    const total = Number(result.total);
    return {
      items: result.items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  });
}

export async function revokeOwnedSession(actor: RequestActor, id: string, requestId: string) {
  await withTransaction(async (db) => {
    await authRepository.lockUser(db, actor.id);
    await usersRepository.profile(db, actor, true);
    const result = await authRepository.revokeOwnedSession(db, actor.id, id);
    if (!result) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy phiên.');
    if (result.changed)
      await authRepository.audit(db, actor.id, 'auth.session.revoke', id, requestId);
  });
}

export async function logoutAll(actor: RequestActor, requestId: string) {
  await withTransaction(async (db) => {
    await authRepository.lockUser(db, actor.id);
    await usersRepository.profile(db, actor, true);
    await authRepository.revokeAll(db, actor.id);
    await authRepository.audit(db, actor.id, 'auth.logout_all', actor.sessionId, requestId);
  });
}
