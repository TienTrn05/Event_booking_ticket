import type { PoolClient } from 'pg';
import { AppError } from '../../shared/errors/app-error.js';
import type {
  AuditQuery,
  ChangeResult,
  CreateRoleInput,
  Role,
  RolesQuery,
  UpdateRoleInput,
  UsersQuery,
} from './rbac.schema.js';
const projection = `r.id::text,r.code,r.name,r.description,r.base_role AS "baseRole",r.status,r.version,
 r.code IN ('CUSTOMER','ORGANIZER','ADMIN') AS system,
 (SELECT count(*)::int FROM user_roles WHERE role_id=r.id) AS "userCount",
 ARRAY(SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=r.id ORDER BY p.code) AS "permissionCodes"`;
export class RbacRepository {
  private busy(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error && error.code === '55P03')
      throw new AppError(
        409,
        'RBAC_BUSY',
        'Tài khoản hoặc quyền đang được dùng bởi một thao tác khác. Hãy thử lại.',
      );
    throw error;
  }
  // Serialize administrative writes before User locks; never cache authorization in JWT.
  async gate(db: PoolClient) {
    await db.query("SELECT id FROM roles WHERE code='ADMIN' FOR UPDATE");
  }
  async lockUsers(db: PoolClient, ids: string[]) {
    // Existing business flows may lock another User after their actor. Fail
    // promptly instead of forming a User/permission lock cycle with them.
    try {
      await db.query(
        'SELECT id FROM users WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE NOWAIT',
        [ids],
      );
    } catch (error) {
      this.busy(error);
    }
  }
  async roles(db: PoolClient, q: RolesQuery) {
    const items = (
      await db.query<Role>(
        `SELECT ${projection} FROM roles r WHERE ($1::text IS NULL OR r.status=$1) ORDER BY r.id LIMIT $2 OFFSET $3`,
        [q.status ?? null, q.pageSize, (q.page - 1) * q.pageSize],
      )
    ).rows;
    const total = (
      await db.query<{ total: number }>(
        'SELECT count(*)::int AS total FROM roles WHERE ($1::text IS NULL OR status=$1)',
        [q.status ?? null],
      )
    ).rows[0]!.total;
    return { items, total };
  }
  async role(db: PoolClient, id: string, lock = false) {
    if (lock) await db.query('SELECT id FROM roles WHERE id=$1 FOR UPDATE', [id]);
    const row = (await db.query<Role>(`SELECT ${projection} FROM roles r WHERE r.id=$1`, [id]))
      .rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy role.');
    return row;
  }
  async permissions(db: PoolClient) {
    return (
      await db.query<{
        code: string;
        description: string;
        baseRoles: string[];
      }>(`SELECT p.code,p.description,
     ARRAY(SELECT r.code FROM roles r JOIN role_permissions rp ON rp.role_id=r.id WHERE rp.permission_id=p.id AND r.code IN ('CUSTOMER','ORGANIZER','ADMIN') ORDER BY r.code) AS "baseRoles" FROM permissions p ORDER BY p.code`)
    ).rows;
  }
  async user(db: PoolClient, id: string) {
    const row = (
      await db.query<{
        id: string;
        displayName: string;
        status: string;
        onboarded: boolean;
        rolesVersion: number;
        roles: Role[];
        permissionCodes: string[];
      }>(
        `SELECT u.id::text,u.display_name AS "displayName",u.status,u.onboarding_completed_at IS NOT NULL AS onboarded,u.roles_version AS "rolesVersion",
     COALESCE((SELECT jsonb_agg(x ORDER BY x.code) FROM (SELECT ${projection} FROM roles r JOIN user_roles ur ON ur.role_id=r.id WHERE ur.user_id=u.id) x),'[]'::jsonb) AS roles,
     ARRAY(SELECT DISTINCT p.code FROM user_roles ur JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id WHERE ur.user_id=u.id ORDER BY p.code) AS "permissionCodes"
     FROM users u WHERE u.id=$1`,
        [id],
      )
    ).rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy User.');
    return row;
  }
  async users(db: PoolClient, q: UsersQuery) {
    // Search names/IDs only; identity emails, phone aliases and credentials stay private.
    const pattern = '%' + q.search.replace(/[\\%_]/g, '\\$&') + '%';
    const row = (
      await db.query<{
        items: { id: string; displayName: string; status: string }[];
        total: number;
      }>(
        `WITH matches AS (
     SELECT id::text,display_name AS "displayName",status FROM users WHERE id::text=$1 OR display_name ILIKE $2),
     page AS(SELECT * FROM matches ORDER BY id::bigint LIMIT $3 OFFSET $4)
     SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(p ORDER BY p.id::bigint) FROM page p),'[]'::jsonb) AS items`,
        [q.search, pattern, q.pageSize, (q.page - 1) * q.pageSize],
      )
    ).rows[0]!;
    return row;
  }
  async create(db: PoolClient, input: CreateRoleInput) {
    const row = (
      await db.query<{ id: string }>(
        `INSERT INTO roles(code,name,description,base_role) VALUES($1,$2,$3,$4) ON CONFLICT(code) DO NOTHING RETURNING id::text`,
        [input.code, input.name, input.description, input.baseRole],
      )
    ).rows[0];
    if (!row) throw new AppError(409, 'ROLE_CODE_EXISTS', 'Mã role đã tồn tại.');
    return row.id;
  }
  async update(db: PoolClient, id: string, input: UpdateRoleInput) {
    await db.query('UPDATE roles SET name=$2,description=$3,version=version+1 WHERE id=$1', [
      id,
      input.name,
      input.description,
    ]);
  }
  async setPermissions(db: PoolClient, id: string, codes: string[]) {
    try {
      await db.query('SELECT role_id FROM role_permissions WHERE role_id=$1 FOR UPDATE NOWAIT', [
        id,
      ]);
    } catch (error) {
      this.busy(error);
    }
    await db.query('DELETE FROM role_permissions WHERE role_id=$1', [id]);
    await db.query(
      'INSERT INTO role_permissions(role_id,permission_id) SELECT $1,id FROM permissions WHERE code=ANY($2::text[])',
      [id, codes],
    );
  }
  async archive(db: PoolClient, id: string) {
    await db.query("UPDATE roles SET status='ARCHIVED',version=version+1 WHERE id=$1", [id]);
  }
  async grant(db: PoolClient, userId: string, roleId: string, actorId: string) {
    await db.query('INSERT INTO user_roles(user_id,role_id,granted_by) VALUES($1,$2,$3)', [
      userId,
      roleId,
      actorId,
    ]);
  }
  async revoke(db: PoolClient, userId: string, roleId: string) {
    await db.query('DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2', [userId, roleId]);
  }
  async activeAdmins(db: PoolClient) {
    return (
      await db.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM users u WHERE u.status='ACTIVE' AND u.onboarding_completed_at IS NOT NULL AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=u.id AND r.code='ADMIN')`,
      )
    ).rows[0]!.count;
  }
  async audit(
    db: PoolClient,
    actorId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    version: number,
    reason: string,
    before: unknown,
    after: unknown,
    requestId: string,
  ) {
    const row = (
      await db.query<{ id: string }>(
        `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id,reason,before_redacted,after_redacted)
     VALUES('USER',$1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb) RETURNING id::text`,
        [
          actorId,
          action,
          resourceType,
          resourceId,
          requestId,
          reason,
          JSON.stringify(before),
          JSON.stringify({ ...(after as object), version }),
        ],
      )
    ).rows[0]!;
    return { auditId: row.id, resourceType, resourceId, version };
  }
  async replay(db: PoolClient, id: string): Promise<ChangeResult> {
    const row = (
      await db.query<ChangeResult>(
        `SELECT id::text AS "auditId",resource_type AS "resourceType",resource_id::text AS "resourceId",(after_redacted->>'version')::int AS version FROM audit_logs WHERE id=$1 AND action LIKE 'rbac.%'`,
        [id],
      )
    ).rows[0];
    if (!row) throw new AppError(409, 'RBAC_CONFLICT', 'Không tìm thấy kết quả thay đổi.');
    return row;
  }
  async audits(db: PoolClient, q: AuditQuery) {
    return (
      await db.query<{ items: Record<string, unknown>[]; total: number }>(
        `WITH matches AS (
     SELECT id::text,actor_id::text AS "actorId",action,resource_type AS "resourceType",resource_id::text AS "resourceId",reason,before_redacted AS before,after_redacted AS after,request_id AS "requestId",created_at AS "createdAt"
     FROM audit_logs WHERE action LIKE 'rbac.%' AND ($1::bigint IS NULL OR (resource_type='RBAC_USER' AND resource_id=$1))
     AND ($2::bigint IS NULL OR (resource_type='RBAC_ROLE' AND resource_id=$2) OR after_redacted->>'roleId'=$2::text)),
     page AS(SELECT * FROM matches ORDER BY id::bigint DESC LIMIT $3 OFFSET $4)
     SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(p ORDER BY p.id::bigint DESC) FROM page p),'[]'::jsonb) AS items`,
        [q.userId ?? null, q.roleId ?? null, q.pageSize, (q.page - 1) * q.pageSize],
      )
    ).rows[0]!;
  }
}
