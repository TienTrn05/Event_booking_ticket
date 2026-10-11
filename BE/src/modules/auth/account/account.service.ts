import { withConnection } from '../../../shared/database/pool.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { authRepository } from '../auth.repository.js';
import { authenticatedUser } from '../session/session.service.js';
export async function currentUser(header: string | undefined) {
  const user = await authenticatedUser(header);
  return { id: user.id, displayName: user.displayName };
}

export async function currentMethods(header: string | undefined) {
  const user = await authenticatedUser(header);
  return withConnection((db) => authRepository.loginMethods(db, user.id));
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
