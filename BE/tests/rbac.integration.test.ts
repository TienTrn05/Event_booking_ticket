import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';
import request from 'supertest';
import { pool } from '../src/shared/database/pool.js';
import { RbacService } from '../src/modules/access-control/rbac.service.js';
import { RbacRepository } from '../src/modules/access-control/rbac.repository.js';
import { createRoleInput, updateRoleInput } from '../src/modules/access-control/rbac.schema.js';
import type { Role } from '../src/modules/access-control/rbac.schema.js';
import type { RequestActor } from '../src/shared/auth/request-actor.js';
import { v1Account, uid } from './fixtures/v1-extensions.js';
import { createApp } from '../src/app.js';
import { accessToken } from '../src/modules/auth/session/session.service.js';
import { env } from '../src/config/env.js';
import { OperationsService } from '../src/modules/operations/operations.service.js';
import { statisticsQuery } from '../src/modules/operations/operations.schema.js';
import { runCommerceBrowser } from './fixtures/commerce-browser.js';
import { postgresCatalogRepository } from '../src/modules/catalog/catalog.repository.js';

describe.skipIf(!process.env.COMMERCE_TEST_DB_PORT)('dynamic RBAC on PostgreSQL', () => {
  const s = new RbacService(),
    reason = 'Fixture access policy review';
  let admin: RequestActor, other: RequestActor, customer: RequestActor, organizer: RequestActor;
  beforeAll(async () => {
    admin = await v1Account('ADMIN');
    other = await v1Account('ADMIN');
    customer = await v1Account();
    organizer = await v1Account('ORGANIZER');
  });
  afterAll(() => pool.end());
  const roles = () => s.roles(admin, { page: 1, pageSize: 100 });
  async function role(code: string) {
    return (await roles()).items.find((r) => r.code === code)!;
  }
  async function custom(baseRole: 'CUSTOMER' | 'ORGANIZER' | 'ADMIN' = 'CUSTOMER') {
    const input = createRoleInput.parse({
      code: 'CUSTOM_T' + uid().replaceAll('-', '').toUpperCase(),
      name: 'Fixture role',
      baseRole,
      permissionCodes: ['profile.update_self'],
      reason,
    });
    const change = await s.create(admin, input, uid(), uid());
    return (await roles()).items.find((r) => r.id === change.resourceId)!;
  }
  const assign = async (
    actor: RequestActor,
    target: RequestActor,
    r: Role,
    grant = true,
    key = uid(),
  ) =>
    s.assignment(
      actor,
      target.id,
      r.id,
      grant,
      {
        rolesVersion: (await s.user(actor, target.id)).rolesVersion,
        roleVersion: r.version,
        reason,
      },
      key,
      uid(),
    );
  it('requires ADMIN and live rbac.manage independently of registration_role', async () => {
    await expect(s.permissions(customer)).rejects.toMatchObject({ status: 403 });
    await pool.query("UPDATE users SET registration_role='ORGANIZER' WHERE id=$1", [customer.id]);
    await expect(s.roles(customer, { page: 1, pageSize: 20 })).rejects.toMatchObject({
      status: 403,
    });
    const a = await v1Account('ADMIN');
    await pool.query('DELETE FROM user_roles WHERE user_id=$1', [a.id]);
    await expect(s.permissions(a)).rejects.toMatchObject({ status: 403 });
    const catalog = await s.permissions(admin);
    expect(catalog.items.find((p) => p.code === 'rbac.manage')?.baseRoles).toEqual(['ADMIN']);
  });
  it('validates permission scope and protects built-in roles/catalog', async () => {
    await expect(
      s.create(
        admin,
        createRoleInput.parse({
          code: 'CUSTOM_INVALID',
          name: 'Invalid',
          baseRole: 'CUSTOMER',
          permissionCodes: ['rbac.manage'],
          reason,
        }),
        uid(),
        uid(),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_SCOPE' });
    await expect(
      s.create(
        admin,
        createRoleInput.parse({
          code: 'CUSTOM_UNKNOWN',
          name: 'Unknown',
          baseRole: 'ADMIN',
          permissionCodes: ['unknown.permission'],
          reason,
        }),
        uid(),
        uid(),
      ),
    ).rejects.toMatchObject({ code: 'PERMISSION_SCOPE' });
    const original = await role('CUSTOMER');
    await expect(
      s.update(
        admin,
        original.id,
        updateRoleInput.parse({
          name: original.name,
          description: original.description,
          permissionCodes: [],
          version: original.version,
          reason,
        }),
        uid(),
        uid(),
      ),
    ).rejects.toMatchObject({ code: 'SYSTEM_ROLE_PROTECTED' });
  });
  it('writes versioned role changes and exactly one audit per idempotent command', async () => {
    const input = createRoleInput.parse({
      code: 'CUSTOM_T' + uid().replaceAll('-', '').toUpperCase(),
      name: 'Reviewers',
      baseRole: 'ADMIN',
      permissionCodes: ['audit.read'],
      reason,
    });
    const key = uid(),
      first = await s.create(admin, input, key, uid());
    expect(await s.create(admin, input, key, uid())).toEqual(first);
    await expect(
      s.create(admin, { ...input, name: 'Different' }, key, uid()),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    const body = updateRoleInput.parse({
      name: 'Updated',
      description: 'Review group',
      permissionCodes: ['audit.read', 'profile.update_self'],
      version: 0,
      reason,
    });
    const change = await s.update(admin, first.resourceId, body, uid(), uid());
    expect(change.version).toBe(1);
    await expect(s.update(admin, first.resourceId, body, uid(), uid())).rejects.toMatchObject({
      code: 'RBAC_VERSION_CONFLICT',
    });
    const audits = await s.audits(admin, { roleId: first.resourceId, page: 1, pageSize: 20 });
    expect(audits.total).toBe(2);
    expect(audits.items[0]).toMatchObject({
      actorId: admin.id,
      reason,
      action: 'rbac.role.update',
      before: { version: 0 },
      after: { version: 1 },
    });
  });
  it('denies self grants/revocations and editing a role held by the actor', async () => {
    const r = await custom('ADMIN');
    await expect(assign(admin, admin, r)).rejects.toMatchObject({ code: 'SELF_CHANGE_FORBIDDEN' });
    await assign(other, admin, r);
    const body = updateRoleInput.parse({
      name: 'Self escalation',
      description: '',
      permissionCodes: ['rbac.manage'],
      version: r.version,
      reason,
    });
    await expect(s.update(admin, r.id, body, uid(), uid())).rejects.toMatchObject({
      code: 'SELF_CHANGE_FORBIDDEN',
    });
    await expect(assign(admin, admin, await role('ADMIN'), false)).rejects.toMatchObject({
      code: 'SELF_CHANGE_FORBIDDEN',
    });
    await assign(other, admin, r, false);
  });
  it('enforces audience, onboarding, active User and business-only system roles', async () => {
    const r = await custom('ORGANIZER');
    await expect(assign(admin, customer, r)).rejects.toMatchObject({
      code: 'ROLE_AUDIENCE_MISMATCH',
    });
    await expect(assign(admin, organizer, await role('CUSTOMER'))).rejects.toMatchObject({
      code: 'SYSTEM_ROLE_PROTECTED',
    });
    const blocked = await v1Account();
    await pool.query("UPDATE users SET status='BLOCKED' WHERE id=$1", [blocked.id]);
    await expect(assign(admin, blocked, await role('ADMIN'))).rejects.toMatchObject({
      code: 'USER_ROLE_INELIGIBLE',
    });
    const incomplete = await v1Account();
    await pool.query('UPDATE users SET onboarding_completed_at=NULL WHERE id=$1', [incomplete.id]);
    await expect(assign(admin, incomplete, await role('ADMIN'))).rejects.toMatchObject({
      code: 'USER_ROLE_INELIGIBLE',
    });
  });
  it('grants/revokes ADMIN immediately without new JWT or changing onboarding choice', async () => {
    const a = await v1Account(),
      r = await role('ADMIN'),
      before = await s.user(admin, a.id),
      key = uid();
    const input = { rolesVersion: before.rolesVersion, roleVersion: r.version, reason };
    const change = await s.assignment(admin, a.id, r.id, true, input, key, uid());
    expect(await s.assignment(admin, a.id, r.id, true, input, key, uid())).toEqual(change);
    expect((await s.user(admin, a.id)).rolesVersion).toBe(before.rolesVersion + 1);
    await expect(
      new OperationsService().statistics(a, statisticsQuery.parse({})),
    ).resolves.toHaveProperty('users');
    await expect(s.assignment(admin, a.id, r.id, false, input, uid(), uid())).rejects.toMatchObject(
      { code: 'RBAC_VERSION_CONFLICT' },
    );
    await assign(admin, a, r, false);
    await expect(s.permissions(a)).rejects.toMatchObject({ status: 403 });
    expect(
      (await pool.query('SELECT registration_role FROM users WHERE id=$1', [a.id])).rows[0]!
        .registration_role,
    ).toBe('CUSTOMER');
    const audits = await s.audits(admin, { userId: a.id, page: 1, pageSize: 20 });
    expect(audits.total).toBe(2);
  });
  it('requires fresh authentication for writes, including idempotent replays', async () => {
    const a = await v1Account('ADMIN'),
      input = createRoleInput.parse({
        code: 'CUSTOM_T' + uid().replaceAll('-', '').toUpperCase(),
        name: 'Recent',
        baseRole: 'ADMIN',
        permissionCodes: [],
        reason,
      }),
      key = uid();
    await s.create(a, input, key, uid());
    await pool.query(
      "UPDATE auth_sessions SET authenticated_at=clock_timestamp()-interval '6 minutes' WHERE id=$1",
      [a.sessionId],
    );
    await expect(s.create(a, input, key, uid())).rejects.toMatchObject({
      code: 'REAUTHENTICATION_REQUIRED',
    });
    await expect(
      s.create(a, { ...input, code: 'CUSTOM_OTHER' }, uid(), uid()),
    ).rejects.toMatchObject({ code: 'REAUTHENTICATION_REQUIRED' });
    await expect(s.permissions(a)).resolves.toHaveProperty('items');
  });
  it('revocation is serialized against an actor already waiting for a transaction', async () => {
    const a = await v1Account('ADMIN'),
      target = await v1Account(),
      r = await role('ADMIN');
    const blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query("SELECT id FROM roles WHERE code='ADMIN' FOR UPDATE");
      const input = createRoleInput.parse({
        code: 'CUSTOM_T' + uid().replaceAll('-', '').toUpperCase(),
        name: 'Expired authority',
        baseRole: 'ADMIN',
        permissionCodes: [],
        reason,
      });
      const waiting = s.create(a, input, uid(), uid()).then(
        () => ({ code: 'SUCCESS' }),
        (e: unknown) => e,
      );
      await blocker.query('DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2', [a.id, r.id]);
      await blocker.query('COMMIT');
      expect(await waiting).toMatchObject({ status: 403 });
      expect((await s.user(admin, target.id)).roles).toHaveLength(1);
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
  });
  it('rolls back when recent authentication expires while waiting for a role lock', async () => {
    const a = await v1Account('ADMIN'),
      r = await custom(),
      blocker = await pool.connect();
    let pending: Promise<unknown> | undefined;
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM roles WHERE id=$1 FOR UPDATE', [r.id]);
      await pool.query(
        "UPDATE auth_sessions SET authenticated_at=clock_timestamp()-interval '5 minutes'+interval '2 seconds' WHERE id=$1",
        [a.sessionId],
      );
      pending = s
        .update(
          a,
          r.id,
          updateRoleInput.parse({
            name: 'Expired pending change',
            description: '',
            permissionCodes: [],
            version: r.version,
            reason,
          }),
          uid(),
          uid(),
        )
        .then(
          () => ({ code: 'SUCCESS' }),
          (e: unknown) => e,
        );
      let waiting = false;
      for (let i = 0; i < 50; i++) {
        const row = (
          await pool.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query='SELECT id FROM roles WHERE id=$1 FOR UPDATE'",
          )
        ).rows[0]!;
        if (row.n > 0) {
          waiting = true;
          break;
        }
        await new Promise((done) => setTimeout(done, 20));
      }
      expect(waiting).toBe(true);
      await pool.query(
        "SELECT pg_sleep(GREATEST(0,EXTRACT(EPOCH FROM (authenticated_at+interval '5 minutes'-clock_timestamp())))+0.05) FROM auth_sessions WHERE id=$1",
        [a.sessionId],
      );
      await blocker.query('COMMIT');
      expect(await pending).toMatchObject({ code: 'REAUTHENTICATION_REQUIRED' });
      expect((await roles()).items.find((v) => v.id === r.id)).toMatchObject({
        name: r.name,
        version: r.version,
        permissionCodes: r.permissionCodes,
      });
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
      if (pending) await pending;
    }
  }, 10000);
  it('archives only unassigned custom roles and retains their audit/permission history', async () => {
    const r = await custom();
    await assign(admin, customer, r);
    await expect(
      s.archive(admin, r.id, { version: r.version, reason }, uid(), uid()),
    ).rejects.toMatchObject({ code: 'ROLE_IN_USE' });
    await assign(admin, customer, r, false);
    const change = await s.archive(admin, r.id, { version: r.version, reason }, uid(), uid());
    expect(change.version).toBe(1);
    const archived = (
      await s.roles(admin, { page: 1, pageSize: 100, status: 'ARCHIVED' })
    ).items.find((x) => x.id === r.id)!;
    expect(archived.permissionCodes).toEqual(r.permissionCodes);
    await expect(assign(admin, customer, archived)).rejects.toMatchObject({
      code: 'USER_ROLE_INELIGIBLE',
    });
    await expect(
      pool.query('INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)', [customer.id, r.id]),
    ).rejects.toMatchObject({ code: '23514' });
  });
  it('requires removing ADMIN supplements before revoking the base ADMIN role', async () => {
    const a = await v1Account('ADMIN'),
      r = await custom('ADMIN');
    await assign(admin, a, r);
    await expect(assign(admin, a, await role('ADMIN'), false)).rejects.toMatchObject({
      code: 'DEPENDENT_ROLES_EXIST',
    });
    await assign(admin, a, r, false);
    await assign(admin, a, await role('ADMIN'), false);
  });
  it('concurrent Admin cross-revocations leave one authorized Admin', async () => {
    const a = await v1Account('ADMIN'),
      b = await v1Account('ADMIN'),
      r = await role('ADMIN');
    const ua = await s.user(admin, a.id),
      ub = await s.user(admin, b.id);
    const results = await Promise.allSettled([
      s.assignment(
        a,
        b.id,
        r.id,
        false,
        { rolesVersion: ub.rolesVersion, roleVersion: r.version, reason },
        uid(),
        uid(),
      ),
      s.assignment(
        b,
        a.id,
        r.id,
        false,
        { rolesVersion: ua.rolesVersion, roleVersion: r.version, reason },
        uid(),
        uid(),
      ),
    ]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
    const count = (
      await pool.query(
        'SELECT count(*)::int AS n FROM user_roles WHERE user_id=ANY($1::bigint[]) AND role_id=$2',
        [[a.id, b.id], r.id],
      )
    ).rows[0]!.n;
    expect(count).toBe(1);
  });
  it('rolls back role permissions and audit when a later step fails', async () => {
    const r = await custom(),
      before = (await s.audits(admin, { roleId: r.id, page: 1, pageSize: 20 })).total;
    const repository = new RbacRepository();
    vi.spyOn(repository, 'audit').mockRejectedValueOnce(Error('fixture audit failure'));
    await expect(
      new RbacService(repository).update(
        admin,
        r.id,
        updateRoleInput.parse({
          name: 'Must roll back',
          permissionCodes: [],
          version: r.version,
          reason,
        }),
        uid(),
        uid(),
      ),
    ).rejects.toThrow('fixture audit failure');
    expect((await roles()).items.find((x) => x.id === r.id)).toMatchObject({
      name: r.name,
      permissionCodes: r.permissionCodes,
    });
    expect((await s.audits(admin, { roleId: r.id, page: 1, pageSize: 20 })).total).toBe(before);
  });
  it('rejects busy Users/permissions without waiting in a business lock cycle', async () => {
    const r = await custom(),
      blocker = await pool.connect();
    try {
      await blocker.query('BEGIN');
      await blocker.query('SELECT role_id FROM role_permissions WHERE role_id=$1 FOR SHARE', [
        r.id,
      ]);
      await expect(
        s.update(
          admin,
          r.id,
          updateRoleInput.parse({
            name: 'Busy change',
            description: '',
            permissionCodes: [],
            version: r.version,
            reason,
          }),
          uid(),
          uid(),
        ),
      ).rejects.toMatchObject({ code: 'RBAC_BUSY' });
      await blocker.query('ROLLBACK');
      await blocker.query('BEGIN');
      await blocker.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [customer.id]);
      await expect(
        s.assignment(
          admin,
          customer.id,
          r.id,
          true,
          { rolesVersion: 0, roleVersion: r.version, reason },
          uid(),
          uid(),
        ),
      ).rejects.toMatchObject({ code: 'RBAC_BUSY' });
    } finally {
      await blocker.query('ROLLBACK');
      blocker.release();
    }
    expect((await roles()).items.find((v) => v.id === r.id)).toMatchObject({
      name: r.name,
      version: r.version,
      permissionCodes: r.permissionCodes,
    });
  });
  it.skipIf(process.env.RBAC_TEST_BROWSER !== '1')(
    'browser manages roles, ADMIN grants/revocations and audit, and denies stale/non-Admin access',
    async () => {
      const actor = await v1Account('ADMIN'),
        target = await v1Account();
      const code = 'BROWSER_' + uid().replaceAll('-', '').toUpperCase();
      const app = createApp({
        checkDatabase: async () => {},
        catalogRepository: postgresCatalogRepository,
      });
      await runCommerceBrowser({
        app,
        origin: env.PUBLIC_APP_URL!,
        async run(browser) {
          async function login(a: RequestActor) {
            const raw = randomBytes(32).toString('base64url');
            await pool.query(
              "INSERT INTO refresh_tokens(session_id,token_hash,expires_at) VALUES($1,$2,clock_timestamp()+interval '6 days')",
              [a.sessionId, createHash('sha256').update(raw).digest()],
            );
            await browser.send('Network.clearBrowserCookies');
            await browser.send('Network.setCookie', {
              name: 'eventix.refresh',
              value: raw,
              url: env.PUBLIC_APP_URL!,
              path: '/api/v1/auth',
              httpOnly: true,
              sameSite: 'Lax',
            });
            await browser.send('Page.navigate', { url: env.PUBLIC_APP_URL! + '/admin/rbac' });
          }
          const click = async (expression: string) => {
            await browser.until(
              `(()=>{const e=(${expression});return !!e&&!e.matches(':disabled');})()`,
            );
            return browser.evaluate(`(${expression}).click();true`);
          };
          async function fill(selector: string, value: string) {
            await browser.until(
              `(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e&&!e.matches(':disabled');})()`,
            );
            await browser.evaluate(
              `(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`,
            );
          }
          const button = (text: string, scope = 'main') =>
            `Array.from(document.querySelectorAll(${JSON.stringify(scope + ' button')})).find(b=>b.textContent.trim()===${JSON.stringify(text)})`;
          async function search(id: string) {
            await fill('.rbac-search input', id);
            await click(button('Tìm kiếm'));
            await browser.until(
              `Array.from(document.querySelectorAll('.rbac-role-list button')).some(b=>b.textContent.includes('#${id}'))`,
            );
            await click(
              `Array.from(document.querySelectorAll('.rbac-role-list button')).find(b=>b.textContent.includes('#${id}'))`,
            );
            await browser.until(
              `document.querySelector('.rbac-assigned')!==null && document.querySelector('main h2:last-of-type')!==null`,
            );
          }
          async function confirm(grant: boolean) {
            await fill('.rbac-confirm textarea', 'Browser fixture reviewed access');
            await click(button(grant ? 'Xác nhận cấp role' : 'Xác nhận thu hồi', '.rbac-confirm'));
            await browser.until(
              "!document.querySelector('.rbac-confirm') && !!document.querySelector('.rbac-success') && !!document.querySelector('.rbac-assigned')",
            );
          }
          await login(actor);
          await browser.until('!!document.querySelector(\'input[aria-label="Mã role"]\')');
          await fill('input[aria-label="Mã role"]', code);
          await fill('.rbac-card input[maxlength="120"]', 'Browser access team');
          await fill('.rbac-card textarea:last-of-type', 'Browser fixture create role');
          // Description and reason are separate labelled fields.
          await browser.evaluate(
            "(()=>{const areas=document.querySelectorAll('.rbac-card textarea');const e=areas[areas.length-1];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Browser fixture create role');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()",
          );
          await click("document.querySelector('.rbac-card form button[type=submit]')");
          await browser.until(
            `Array.from(document.querySelectorAll('.rbac-role-list button')).some(b=>b.textContent.includes(${JSON.stringify('CUSTOM_' + code)}))`,
          );
          await click(
            `Array.from(document.querySelectorAll('.rbac-role-list button')).find(b=>b.textContent.includes(${JSON.stringify('CUSTOM_' + code)}))`,
          );
          await browser.until(
            "!!document.querySelector('.rbac-card form button[type=submit]') && document.querySelector('.rbac-card form button[type=submit]').textContent==='Lưu thay đổi'",
          );
          await fill('.rbac-card input[maxlength="120"]', 'Browser access team updated');
          await click(
            "Array.from(document.querySelectorAll('.rbac-permissions label')).find(l=>l.textContent.includes('profile.update_self')).querySelector('input')",
          );
          await browser.evaluate(
            "(()=>{const areas=document.querySelectorAll('.rbac-card textarea');const e=areas[areas.length-1];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Browser fixture update role');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()",
          );
          await click("document.querySelector('.rbac-card form button[type=submit]')");
          await browser.until(
            "!!document.querySelector('.rbac-success') && document.querySelector('.rbac-role-list').textContent.includes('Browser access team updated')",
          );
          await click(button('Người dùng'));
          await search(target.id);
          await click(
            `Array.from(document.querySelectorAll('.rbac-grants button')).find(b=>b.textContent.includes(${JSON.stringify('CUSTOM_' + code)}))`,
          );
          await confirm(true);
          await browser.until(
            `document.querySelector('.rbac-assigned')?.textContent.includes(${JSON.stringify('CUSTOM_' + code)})`,
          );
          await click(
            `Array.from(document.querySelectorAll('.rbac-assigned li')).find(b=>b.textContent.includes(${JSON.stringify('CUSTOM_' + code)})).querySelector('button')`,
          );
          await confirm(false);
          await click(
            "Array.from(document.querySelectorAll('.rbac-grants button')).find(b=>b.querySelector('small')?.textContent==='ADMIN')",
          );
          await confirm(true);
          await expect(s.permissions(target)).resolves.toHaveProperty('items');
          await click(
            "Array.from(document.querySelectorAll('.rbac-assigned li')).find(b=>b.querySelector('small')?.textContent==='ADMIN').querySelector('button')",
          );
          await confirm(false);
          await expect(s.permissions(target)).rejects.toMatchObject({ status: 403 });
          await search(actor.id);
          await browser.until(
            "document.querySelector('main')?.textContent.includes('Bạn chỉ được xem quyền của mình')",
          );
          expect(
            await browser.evaluate(
              "Array.from(document.querySelectorAll('.rbac-assigned button,.rbac-grants button')).every(b=>b.disabled)",
            ),
          ).toBe(true);
          await click(button('Lịch sử'));
          await browser.until("document.querySelectorAll('.rbac-table-wrap tbody tr').length>0");
          expect(
            await browser.evaluate(
              "document.querySelector('.rbac-table-wrap').textContent.includes('Browser fixture')",
            ),
          ).toBe(true);
          await click("document.querySelector('.rbac-table-wrap details summary')");
          expect(
            await browser.evaluate(
              "document.querySelector('.rbac-table-wrap pre').textContent.includes('before')",
            ),
          ).toBe(true);
          await browser.send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: true,
          });
          expect(
            await browser.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),
          ).toBe(true);
          await browser.send('Emulation.clearDeviceMetricsOverride');
          await pool.query(
            "UPDATE auth_sessions SET authenticated_at=clock_timestamp()-interval '6 minutes' WHERE id=$1",
            [actor.sessionId],
          );
          await click(button('Vai trò'));
          await click(button('Tạo role'));
          await fill('input[aria-label="Mã role"]', 'RECENT_REQUIRED');
          await fill('.rbac-card input[maxlength="120"]', 'Must reauthenticate');
          await browser.evaluate(
            "(()=>{const areas=document.querySelectorAll('.rbac-card textarea');const e=areas[areas.length-1];Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,'Browser fixture reauth required');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()",
          );
          await click("document.querySelector('.rbac-card form button[type=submit]')");
          await browser.until(
            "document.querySelector('main')?.textContent.includes('Đăng xuất để đăng nhập lại')",
          );
          await click(button('Đăng xuất để đăng nhập lại'));
          await browser.until(
            "document.querySelector('main')?.textContent.includes('Đăng nhập Admin để tiếp tục')",
          );
          await click(button('Đăng nhập'));
          await browser.until(
            "document.getElementById('eventix-auth-title')?.textContent==='Chào mừng trở lại'",
          );
          await login(target);
          await browser.until(
            "document.querySelector('main')?.textContent.includes('Bạn không có quyền quản trị phân quyền')",
          );
          expect(await browser.evaluate("document.querySelector('.rbac-role-list')===null")).toBe(
            true,
          );
          expect(
            await browser.evaluate(
              '[...Object.keys(localStorage),...Object.keys(sessionStorage)].some(k=>/token|refresh|credential/i.test(k))',
            ),
          ).toBe(false);
        },
      });
    },
    120000,
  );
  it('serves private HTTP endpoints, validates bodies/Origin and supports name/ID search', async () => {
    const app = createApp({ checkDatabase: async () => {} });
    const token = await accessToken({
      userId: admin.id,
      sessionId: admin.sessionId,
      authVersion: admin.authVersion,
      displayName: 'Fixture',
      identityId: '1',
      expiresAt: new Date(Date.now() + 86400000),
      refreshToken: '',
    });
    await request(app).get('/api/v1/admin/rbac/roles').expect(401);
    const res = await request(app)
      .get('/api/v1/admin/rbac/roles')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    const input = {
      code: 'CUSTOM_HTTP',
      name: 'HTTP role',
      baseRole: 'CUSTOMER',
      permissionCodes: [],
      reason,
    };
    await request(app)
      .post('/api/v1/admin/rbac/roles')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', uid())
      .send(input)
      .expect(403);
    await request(app)
      .post('/api/v1/admin/rbac/roles')
      .auth(token, { type: 'bearer' })
      .set('Origin', env.PUBLIC_APP_URL!)
      .set('Idempotency-Key', uid())
      .send({ ...input, admin: true })
      .expect(400);
    await request(app)
      .post('/api/v1/admin/rbac/roles')
      .auth(token, { type: 'bearer' })
      .set('Origin', env.PUBLIC_APP_URL!)
      .set('Idempotency-Key', uid())
      .send(input)
      .expect(200);
    const search = await request(app)
      .get('/api/v1/admin/rbac/users')
      .query({ search: customer.id })
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(search.body.data.items).toContainEqual({
      id: customer.id,
      displayName: 'V1 fixture',
      status: 'ACTIVE',
    });
    expect(JSON.stringify(search.body)).not.toMatch(/email|identity|token|password/i);
    await request(app)
      .get('/api/v1/admin/rbac/users')
      .query({ search: ['x', 'y'] })
      .auth(token, { type: 'bearer' })
      .expect(400);
  });
});
