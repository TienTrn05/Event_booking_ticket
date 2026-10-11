import type { PoolClient } from 'pg';
import type { RefreshRow } from '../shared/auth.repository.types.js';
export const sessionRepository = {
  async createSession(db: PoolClient, userId: string, identityId: string, family: Buffer) {
    const { rows } = await db.query<{ id: string; expires_at: Date }>(
      `INSERT INTO auth_sessions (user_id, identity_id, authenticated_at, family_id, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, $3, CURRENT_TIMESTAMP + INTERVAL '7 days')
       RETURNING id::text, expires_at`,
      [userId, identityId, family],
    );
    return { id: rows[0]!.id, expiresAt: rows[0]!.expires_at };
  },
  async createRefresh(
    db: PoolClient,
    sessionId: string,
    tokenHash: Buffer,
    expiresAt: Date,
    parentId: string | null = null,
  ) {
    await db.query(
      `INSERT INTO refresh_tokens (session_id, parent_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [sessionId, parentId, tokenHash, expiresAt],
    );
  },
  async refreshByHash(db: PoolClient, tokenHash: Buffer): Promise<RefreshRow | undefined> {
    const { rows } = await db.query<RefreshRow>(
      `SELECT rt.id::text, rt.session_id::text, rt.used_at, rt.revoked_at,
        s.user_id::text, s.identity_id::text, s.revoked_at AS session_revoked_at, s.expires_at AS session_expires_at,
        u.display_name, u.status, u.auth_version,
        rt.expires_at > CURRENT_TIMESTAMP AS token_active,
        s.expires_at > CURRENT_TIMESTAMP AS session_active,
        i.revoked_at IS NULL AS identity_active
       FROM refresh_tokens rt JOIN auth_sessions s ON s.id = rt.session_id
       JOIN users u ON u.id = s.user_id
       JOIN external_identities i ON i.id = s.identity_id WHERE rt.token_hash = $1`,
      [tokenHash],
    );
    return rows[0];
  },
  async lockSession(db: PoolClient, sessionId: string) {
    await db.query('SELECT id FROM auth_sessions WHERE id = $1 FOR UPDATE', [sessionId]);
  },
  async lockedRefresh(db: PoolClient, tokenId: string): Promise<RefreshRow | undefined> {
    const { rows } = await db.query<RefreshRow>(
      `SELECT rt.id::text, rt.session_id::text, rt.used_at, rt.revoked_at,
        s.user_id::text, s.identity_id::text, s.revoked_at AS session_revoked_at, s.expires_at AS session_expires_at,
        u.display_name, u.status, u.auth_version,
        rt.expires_at > CURRENT_TIMESTAMP AS token_active,
        s.expires_at > CURRENT_TIMESTAMP AS session_active,
        i.revoked_at IS NULL AS identity_active
       FROM refresh_tokens rt JOIN auth_sessions s ON s.id = rt.session_id
       JOIN users u ON u.id = s.user_id
       JOIN external_identities i ON i.id = s.identity_id WHERE rt.id = $1 FOR UPDATE OF rt`,
      [tokenId],
    );
    return rows[0];
  },
  async markRefreshUsed(db: PoolClient, tokenId: string) {
    await db.query('UPDATE refresh_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = $1', [
      tokenId,
    ]);
  },
  async revokeSession(db: PoolClient, sessionId: string) {
    await db.query(
      'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND revoked_at IS NULL',
      [sessionId],
    );
  },
  async currentUser(db: PoolClient, userId: string, sessionId: string) {
    const { rows } = await db.query<{ id: string; display_name: string; auth_version: number }>(
      `SELECT u.id::text, u.display_name, u.auth_version FROM users u
       JOIN auth_sessions s ON s.user_id = u.id
       JOIN external_identities i ON i.id = s.identity_id AND i.revoked_at IS NULL
       WHERE u.id = $1 AND s.id = $2 AND u.status = 'ACTIVE'
         AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP`,
      [userId, sessionId],
    );
    return rows[0];
  },
};
