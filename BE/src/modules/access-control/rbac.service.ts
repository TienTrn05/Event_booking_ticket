import type { PoolClient } from 'pg';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import { usersRepository } from '../users/repositories/users.repository.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { RbacRepository } from './rbac.repository.js';
import type {
  AssignmentInput,
  AuditQuery,
  ChangeResult,
  CreateRoleInput,
  Role,
  RolesQuery,
  UpdateRoleInput,
  UsersQuery,
} from './rbac.schema.js';
export class RbacService {
  constructor(
    private readonly repository = new RbacRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  private async authorized(db: PoolClient, actor: RequestActor) {
    await this.access.admin(db, actor, 'rbac.manage');
  }
  private read<T>(actor: RequestActor, work: (db: PoolClient) => Promise<T>) {
    return withTransaction(async (db) => {
      await this.authorized(db, actor);
      return work(db);
    });
  }
  roles(actor: RequestActor, q: RolesQuery) {
    return this.read(actor, (db) => this.repository.roles(db, q));
  }
  permissions(actor: RequestActor) {
    return this.read(actor, async (db) => ({ items: await this.repository.permissions(db) }));
  }
  users(actor: RequestActor, q: UsersQuery) {
    return this.read(actor, (db) => this.repository.users(db, q));
  }
  user(actor: RequestActor, id: string) {
    return this.read(actor, (db) => this.repository.user(db, id));
  }
  audits(actor: RequestActor, q: AuditQuery) {
    return this.read(actor, (db) => this.repository.audits(db, q));
  }
  private write(
    actor: RequestActor,
    operation: string,
    key: string,
    input: unknown,
    targetId: string | undefined,
    work: (db: PoolClient) => Promise<ChangeResult>,
  ) {
    return withTransaction(async (db) => {
      await this.repository.gate(db);
      await this.repository.lockUsers(db, targetId ? [actor.id, targetId] : [actor.id]);
      await this.authorized(db, actor);
      await this.access.recent(db, actor);
      await usersRepository.requireOnboarding(db, actor.id);
      const record = await claimKey(db, actor.id, operation, key, input);
      const result = record.resource_id
        ? await this.repository.replay(db, record.resource_id)
        : await work(db);
      // Role/permission locks can wait after the initial checks. Expired authority
      // must roll back the mutation and its audit instead of committing late.
      await usersRepository.profile(db, actor);
      await this.access.recent(db, actor);
      if (!record.resource_id) await finishKey(db, record.id, 'RBAC_CHANGE', result.auditId, 200);
      return result;
    });
  }
  private async permissionsAllowed(db: PoolClient, baseRole: string, codes: string[]) {
    const catalog = await this.repository.permissions(db);
    if (
      codes.some((code) => !catalog.some((p) => p.code === code && p.baseRoles.includes(baseRole)))
    )
      throw new AppError(
        422,
        'PERMISSION_SCOPE',
        'Chỉ chọn permission có sẵn trong nhóm role gốc.',
      );
  }
  private editable(role: Role, version: number) {
    if (role.system) throw new AppError(403, 'SYSTEM_ROLE_PROTECTED', 'Role hệ thống được bảo vệ.');
    if (role.status !== 'ACTIVE' || role.version !== version)
      throw new AppError(409, 'RBAC_VERSION_CONFLICT', 'Role đã thay đổi. Hãy tải lại.');
  }
  create(actor: RequestActor, input: CreateRoleInput, key: string, requestId: string) {
    return this.write(actor, 'rbac.role.create', key, input, undefined, async (db) => {
      await this.permissionsAllowed(db, input.baseRole, input.permissionCodes);
      const id = await this.repository.create(db, input);
      await this.repository.setPermissions(db, id, input.permissionCodes);
      const role = await this.repository.role(db, id);
      return this.repository.audit(
        db,
        actor.id,
        'rbac.role.create',
        'RBAC_ROLE',
        id,
        role.version,
        input.reason,
        null,
        role,
        requestId,
      );
    });
  }
  update(actor: RequestActor, id: string, input: UpdateRoleInput, key: string, requestId: string) {
    return this.write(actor, 'rbac.role.update', key, { id, ...input }, undefined, async (db) => {
      const before = await this.repository.role(db, id, true);
      this.editable(before, input.version);
      if ((await this.repository.user(db, actor.id)).roles.some((r) => r.id === id))
        throw new AppError(
          403,
          'SELF_CHANGE_FORBIDDEN',
          'Không sửa role đang được gán cho chính mình.',
        );
      await this.permissionsAllowed(db, before.baseRole, input.permissionCodes);
      await this.repository.update(db, id, input);
      await this.repository.setPermissions(db, id, input.permissionCodes);
      const after = await this.repository.role(db, id);
      return this.repository.audit(
        db,
        actor.id,
        'rbac.role.update',
        'RBAC_ROLE',
        id,
        after.version,
        input.reason,
        before,
        after,
        requestId,
      );
    });
  }
  archive(
    actor: RequestActor,
    id: string,
    input: { version: number; reason: string },
    key: string,
    requestId: string,
  ) {
    return this.write(actor, 'rbac.role.archive', key, { id, ...input }, undefined, async (db) => {
      const before = await this.repository.role(db, id, true);
      this.editable(before, input.version);
      if (before.userCount)
        throw new AppError(409, 'ROLE_IN_USE', 'Cần thu hồi hết role trước khi lưu trữ.');
      await this.repository.archive(db, id);
      const after = await this.repository.role(db, id);
      return this.repository.audit(
        db,
        actor.id,
        'rbac.role.archive',
        'RBAC_ROLE',
        id,
        after.version,
        input.reason,
        before,
        after,
        requestId,
      );
    });
  }
  assignment(
    actor: RequestActor,
    userId: string,
    roleId: string,
    grant: boolean,
    input: AssignmentInput,
    key: string,
    requestId: string,
  ) {
    return this.write(
      actor,
      grant ? 'rbac.user.grant' : 'rbac.user.revoke',
      key,
      { userId, roleId, ...input },
      userId,
      async (db) => {
        if (actor.id === userId)
          throw new AppError(
            403,
            'SELF_CHANGE_FORBIDDEN',
            'Không tự cấp hoặc thu hồi role của mình.',
          );
        const before = await this.repository.user(db, userId),
          role = await this.repository.role(db, roleId, true);
        if (before.rolesVersion !== input.rolesVersion || role.version !== input.roleVersion)
          throw new AppError(409, 'RBAC_VERSION_CONFLICT', 'Quyền đã thay đổi. Hãy tải lại.');
        if (role.system && role.code !== 'ADMIN')
          throw new AppError(
            403,
            'SYSTEM_ROLE_PROTECTED',
            'Customer/Organizer chỉ được cấp qua luồng nghiệp vụ hiện có.',
          );
        const assigned = before.roles.some((r) => r.id === roleId);
        if (grant === assigned)
          throw new AppError(
            409,
            'RBAC_ASSIGNMENT_CONFLICT',
            'Trạng thái gán role đã thay đổi. Hãy tải lại.',
          );
        if (grant) {
          if (before.status !== 'ACTIVE' || !before.onboarded || role.status !== 'ACTIVE')
            throw new AppError(
              409,
              'USER_ROLE_INELIGIBLE',
              'User cần hoạt động, hoàn tất đăng ký và role còn hiệu lực.',
            );
          if (!role.system && !before.roles.some((r) => r.system && r.code === role.baseRole))
            throw new AppError(
              422,
              'ROLE_AUDIENCE_MISMATCH',
              'User phải có role gốc tương ứng trước khi nhận role bổ sung.',
            );
          await this.repository.grant(db, userId, roleId, actor.id);
        } else {
          if (role.code === 'ADMIN') {
            if (
              before.status === 'ACTIVE' &&
              before.onboarded &&
              (await this.repository.activeAdmins(db)) <= 1
            )
              throw new AppError(
                409,
                'LAST_ADMIN_PROTECTED',
                'Không thể thu hồi Admin hoạt động cuối cùng.',
              );
            if (before.roles.some((r) => !r.system && r.baseRole === 'ADMIN'))
              throw new AppError(
                409,
                'DEPENDENT_ROLES_EXIST',
                'Thu hồi role bổ sung nhóm ADMIN trước.',
              );
          }
          await this.repository.revoke(db, userId, roleId);
        }
        const after = await this.repository.user(db, userId);
        const snapshot = (u: typeof before) => ({
          roleId,
          roleCode: role.code,
          rolesVersion: u.rolesVersion,
          roleIds: u.roles.map((r) => r.id),
        });
        return this.repository.audit(
          db,
          actor.id,
          grant ? 'rbac.user.grant' : 'rbac.user.revoke',
          'RBAC_USER',
          userId,
          after.rolesVersion,
          input.reason,
          snapshot(before),
          snapshot(after),
          requestId,
        );
      },
    );
  }
}
