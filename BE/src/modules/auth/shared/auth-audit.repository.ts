import type { PoolClient } from 'pg';
export const authAuditRepository = {
  async audit(
    db: PoolClient,
    actorId: string,
    action: string,
    sessionId: string,
    requestId: string,
  ) {
    await db.query(
      `INSERT INTO audit_logs (actor_type, actor_id, action, resource_type, resource_id, request_id)
       VALUES ('USER', $1, $2, 'auth_session', $3, $4)`,
      [actorId, action, sessionId, requestId],
    );
  },
  async auditFailure(
    db: PoolClient,
    requestId: string,
    code: string,
    action = 'auth.google.failure',
  ) {
    await db.query(
      `INSERT INTO audit_logs (actor_type, action, resource_type, request_id, reason)
       VALUES ('ANONYMOUS', $3, 'auth_flow', $1, $2)`,
      [requestId, code, action],
    );
  },
};
