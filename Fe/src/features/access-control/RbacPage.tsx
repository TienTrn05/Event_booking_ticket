import Button from '../../shared/ui/Button';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Users, History, Plus, RefreshCw, LockKeyhole } from 'lucide-react';
import { z } from 'zod';
import { useAuthDialog } from '../auth/context/AuthDialogContext';
import { ApiError } from '../../shared/api/client';
import { useLocale } from '../../shared/i18n/LocaleContext';
import {
  auditSchema,
  changeSchema,
  paged,
  permissionSchema,
  rbacError,
  rbacRequest,
  roleSchema,
  userSchema,
  userSummarySchema,
  type Command,
  type Permission,
  type RbacUser,
  type Role,
} from './rbac.api';
import './rbac.css';

type Run = (command: Command) => Promise<boolean>;
export function RbacPage() {
  const { accessToken, user, openAuth } = useAuthDialog();
  const { t } = useLocale();
  return (
    <main id="main" className="rbac-page">
      <header className="rbac-heading">
        <span className="rbac-eyebrow">{t('QUẢN TRỊ HỆ THỐNG', 'ADMINISTRATION')}</span>
        <h1>
          <ShieldCheck aria-hidden="true" />
          {t('Phân quyền truy cập', 'Access management')}
        </h1>
        <p>
          {t(
            'Quản lý vai trò, quyền được cấp và lịch sử thay đổi.',
            'Manage roles, effective permissions, and change history.',
          )}
        </p>
        <Link to="/admin/onboarding">
          {t('Quản lý câu hỏi đăng ký', 'Manage registration questions')} →
        </Link>
      </header>
      {accessToken && user ? (
        <Manager key={user.id} token={accessToken} actorId={user.id} />
      ) : (
        <section className="rbac-card">
          <LockKeyhole aria-hidden="true" />
          <h2>{t('Đăng nhập Admin để tiếp tục', 'Sign in as an administrator')}</h2>
          <p>
            {t(
              'Trang này yêu cầu quyền quản trị phân quyền.',
              'This tool requires access management permission.',
            )}
          </p>
          <Button variant="outline" onClick={() => openAuth('login')}>
            {t('Đăng nhập', 'Sign in')}
          </Button>
        </section>
      )}
    </main>
  );
}
function Pager({
  page,
  total,
  size = 20,
  onChange,
  disabled = false,
}: {
  page: number;
  total: number;
  size?: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <nav className="rbac-pager" aria-label={t('Phân trang', 'Pagination')}>
      <Button
        variant="outline"
        disabled={disabled || page === 1}
        onClick={() => onChange(page - 1)}
      >
        {t('Trước', 'Previous')}
      </Button>
      <span>
        {t('Trang', 'Page')} {page} / {Math.max(1, Math.ceil(total / size))} · {total}{' '}
        {t('kết quả', 'results')}
      </span>
      <Button
        variant="outline"
        disabled={disabled || page * size >= total}
        onClick={() => onChange(page + 1)}
      >
        {t('Sau', 'Next')}
      </Button>
    </nav>
  );
}
function Manager({ token, actorId }: { token: string; actorId: string }) {
  const { logout } = useAuthDialog();
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<'roles' | 'users' | 'audit'>('roles'),
    [roles, setRoles] = useState<Role[]>([]),
    [total, setTotal] = useState(0),
    [permissions, setPermissions] = useState<Permission[]>([]),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [reauth, setReauth] = useState(false),
    [selected, setSelected] = useState<Role | null>(null);
  const pending = useRef<(Command & { key: string }) | null>(null),
    uncertainCommand = useRef<(Command & { key: string }) | null>(null),
    running = useRef(false);
  useEffect(() => {
    const ctrl = new AbortController();
    void Promise.all([
      rbacRequest(token, `/roles?page=${page}&pageSize=20`, paged(roleSchema), {
        signal: ctrl.signal,
      }),
      rbacRequest(token, '/permissions', z.object({ items: z.array(permissionSchema) }), {
        signal: ctrl.signal,
      }),
    ])
      .then(([r, p]) => {
        if (!ctrl.signal.aborted) {
          setRoles(r.items);
          setTotal(r.total);
          setPermissions(p.items);
          setReady(true);
          setError('');
          setSelected((current) =>
            current ? (r.items.find((v) => v.id === current.id) ?? null) : null,
          );
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) {
          setReady(false);
          setError(rbacError(e, locale === 'en'));
          setReauth(e instanceof ApiError && e.status === 401);
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [token, page, revision, locale]);
  const execute: Run = async (command) => {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    setReauth(false);
    const current = pending.current ?? { ...command, key: crypto.randomUUID() };
    pending.current = current;
    try {
      const change = await rbacRequest(token, current.path, changeSchema, {
        method: current.method,
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': current.key },
        body: JSON.stringify(current.body),
      });
      pending.current = null;
      uncertainCommand.current = null;
      setUncertain(false);
      setNotice(`${t('Đã lưu thay đổi. Mã audit', 'Changes saved. Audit ID')} #${change.auditId}.`);
      setLoading(true);
      setRevision((n) => n + 1);
      return true;
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status < 500 &&
        e.code !== 'REQUEST_IN_PROGRESS' &&
        uncertainCommand.current !== current
      ) {
        pending.current = null;
        setUncertain(false);
        setError(rbacError(e, locale === 'en'));
        setReauth(e.status === 401);
      } else {
        uncertainCommand.current = current;
        setUncertain(true);
        setReauth(e instanceof ApiError && e.status === 401);
        setError(
          t(
            'Chưa xác nhận được kết quả. Thử lại đúng yêu cầu đang chờ bằng nút bên dưới.',
            'The result is uncertain. Retry the same pending request using the button below.',
          ),
        );
      }
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const disabled = busy || uncertain || loading || !ready;
  return (
    <>
      <div className="rbac-policy">
        <ShieldCheck aria-hidden="true" />
        <p>
          {t(
            'Role bổ sung cộng quyền với role gốc. Chỉ cấp trong cùng nhóm. Thay đổi quyền cần đăng nhập trong 5 phút và lý do; không được tự sửa quyền của mình.',
            'Additional roles add permissions within their base group. Changes require authentication within 5 minutes and a reason. You cannot change your own access.',
          )}
        </p>
      </div>
      <div className="rbac-toolbar">
        <nav aria-label={t('Chức năng phân quyền', 'Access management tools')}>
          {(
            [
              { id: 'roles', label: t('Vai trò', 'Roles'), Icon: ShieldCheck },
              { id: 'users', label: t('Người dùng', 'Users'), Icon: Users },
              { id: 'audit', label: t('Lịch sử', 'History'), Icon: History },
            ] as const
          ).map(({ id, label, Icon }) => (
            <Button
              variant="outline"
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              disabled={busy || uncertain}
              onClick={() => setTab(id)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </Button>
          ))}
        </nav>
        <Button
          variant="outline"
          disabled={busy || uncertain}
          onClick={() => {
            setLoading(true);
            setRevision((n) => n + 1);
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t('Tải lại', 'Reload')}
        </Button>
      </div>
      {error && (
        <div role="alert" className="rbac-alert">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="rbac-success">
          {notice}
        </p>
      )}
      {reauth && (
        <p>
          <Button variant="outline" disabled={busy} onClick={() => void logout()}>
            {t('Đăng xuất để đăng nhập lại', 'Sign out to authenticate again')}
          </Button>{' '}
          {t(
            'Phiên hiện tại sẽ kết thúc; đăng nhập mới để tiếp tục.',
            'Your current session will end. Sign in again to continue.',
          )}
        </p>
      )}
      {uncertain && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (pending.current) void execute(pending.current);
          }}
        >
          {t('Thử lại yêu cầu đang chờ', 'Retry pending request')}
        </Button>
      )}
      {loading && <p role="status">{t('Đang tải dữ liệu…', 'Loading data…')}</p>}
      {ready && tab === 'roles' && (
        <div className="rbac-columns">
          <section className="rbac-card">
            <div className="rbac-section-heading">
              <h2>{t('Danh sách vai trò', 'Role directory')}</h2>
              <Button variant="outline" disabled={disabled} onClick={() => setSelected(null)}>
                <Plus size={16} aria-hidden="true" />
                {t('Tạo role', 'Create role')}
              </Button>
            </div>
            <ul className="rbac-role-list">
              {roles.map((r) => (
                <li key={r.id}>
                  <Button
                    variant="outline"
                    disabled={disabled}
                    aria-pressed={selected?.id === r.id}
                    onClick={() => setSelected(r)}
                  >
                    <span>
                      <strong>{r.name}</strong>
                      <small>
                        {r.code} · {r.baseRole}
                      </small>
                    </span>
                    <span className="rbac-badge">
                      {r.system
                        ? t('Hệ thống', 'System')
                        : r.status === 'ARCHIVED'
                          ? t('Đã lưu trữ', 'Archived')
                          : `${r.userCount} ${t('người', 'users')}`}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
            <Pager
              page={page}
              total={total}
              onChange={(v) => {
                setLoading(true);
                setPage(v);
              }}
              disabled={disabled}
            />
          </section>
          <RoleEditor
            key={selected ? `${selected.id}:${selected.version}` : 'new'}
            role={selected}
            permissions={permissions}
            disabled={disabled}
            run={execute}
          />
        </div>
      )}
      {ready && tab === 'users' && (
        <UsersPanel
          token={token}
          actorId={actorId}
          revision={revision}
          roles={roles.filter((r) => r.status === 'ACTIVE')}
          page={page}
          total={total}
          onPage={(v) => {
            setLoading(true);
            setPage(v);
          }}
          disabled={disabled}
          run={execute}
        />
      )}
      {ready && tab === 'audit' && <AuditPanel token={token} revision={revision} />}
    </>
  );
}
function RoleEditor({
  role,
  permissions,
  disabled,
  run,
}: {
  role: Role | null;
  permissions: Permission[];
  disabled: boolean;
  run: Run;
}) {
  const { t } = useLocale();
  const [code, setCode] = useState(''),
    [name, setName] = useState(role?.name ?? ''),
    [description, setDescription] = useState(role?.description ?? ''),
    [baseRole, setBaseRole] = useState<Role['baseRole']>(role?.baseRole ?? 'CUSTOMER'),
    [codes, setCodes] = useState(role?.permissionCodes ?? []),
    [reason, setReason] = useState(''),
    [archive, setArchive] = useState(false);
  const immutable = !!role && (role.system || role.status === 'ARCHIVED');
  async function save() {
    const body = role
      ? { name, description, permissionCodes: codes, version: role.version, reason }
      : { code: 'CUSTOM_' + code, name, description, baseRole, permissionCodes: codes, reason };
    if (
      await run({
        path: role ? `/roles/${role.id}` : '/roles',
        method: role ? 'PUT' : 'POST',
        body,
      })
    ) {
      setReason('');
      if (!role) {
        setCode('');
        setName('');
        setDescription('');
        setCodes([]);
      }
    }
  }
  return (
    <section className="rbac-card">
      <h2>{role ? role.name : t('Tạo vai trò bổ sung', 'Create additional role')}</h2>
      {immutable && (
        <p className="rbac-muted">
          {role.system
            ? t(
                'Role hệ thống được bảo vệ. Các quyền bên dưới chỉ để xem.',
                'System roles are protected. Permissions below are read-only.',
              )
            : t(
                'Role đã lưu trữ, giữ lại để tra cứu lịch sử.',
                'Archived roles remain available for historical reference.',
              )}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={disabled || immutable}>
          {!role && (
            <label>
              {t('Mã role', 'Role code')}{' '}
              <span className="rbac-inline">
                <span>CUSTOM_</span>
                <input
                  aria-label={t('Mã role', 'Role code')}
                  required
                  minLength={2}
                  maxLength={40}
                  pattern="[A-Z][A-Z0-9_]{1,39}"
                  placeholder="EVENT_REVIEWERS"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </span>
            </label>
          )}
          <label>
            {t('Tên vai trò', 'Role name')}
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            {t('Mô tả', 'Description')}
            <textarea
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            {t('Nhóm role gốc', 'Base role group')}
            <select
              value={baseRole}
              disabled={!!role}
              onChange={(e) => {
                setBaseRole(e.target.value as Role['baseRole']);
                setCodes([]);
              }}
            >
              {['CUSTOMER', 'ORGANIZER', 'ADMIN'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <p className="rbac-muted">
            {t(
              'User phải có role gốc tương ứng. Role bổ sung không giảm quyền đã có hoặc thay thế quyền sở hữu và thành viên tổ chức.',
              'The user must hold the matching base role. Additional roles do not reduce existing permissions or replace ownership and organization membership.',
            )}
          </p>
          <div className="rbac-permissions" role="group" aria-label="Permission">
            {permissions
              .filter((p) => p.baseRoles.includes(baseRole))
              .map((p) => (
                <label key={p.code}>
                  <input
                    type="checkbox"
                    checked={codes.includes(p.code)}
                    onChange={(e) =>
                      setCodes((v) =>
                        e.target.checked ? [...v, p.code] : v.filter((c) => c !== p.code),
                      )
                    }
                  />
                  <span>
                    <strong>{p.code}</strong>
                    <small>{p.description}</small>
                  </span>
                </label>
              ))}
          </div>
          {!immutable && (
            <>
              <label>
                {t('Lý do thay đổi', 'Reason for change')}
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t(
                    'Nêu mục đích và phạm vi cấp quyền',
                    'Describe the purpose and access scope',
                  )}
                />
              </label>
              <Button variant="primary" className="rbac-primary" type="submit">
                {role ? t('Lưu thay đổi', 'Save changes') : t('Tạo role', 'Create role')}
              </Button>
            </>
          )}
        </fieldset>
      </form>
      {role && !immutable && (
        <div className="rbac-archive">
          <Button
            variant="outline"
            disabled={disabled || role.userCount > 0}
            onClick={() => setArchive((v) => !v)}
          >
            {t('Lưu trữ role', 'Archive role')}
          </Button>
          {role.userCount > 0 && (
            <p>
              {t('Thu hồi', 'Revoke')} {role.userCount}{' '}
              {t('lượt gán trước khi lưu trữ.', 'assignments before archiving.')}
            </p>
          )}
          {archive && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run({
                  path: `/roles/${role.id}/archive`,
                  method: 'POST',
                  body: { version: role.version, reason },
                });
              }}
            >
              <label>
                {t('Lý do lưu trữ', 'Archiving reason')}
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  disabled={disabled}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button variant="outline" type="submit" className="rbac-danger" disabled={disabled}>
                {t('Xác nhận lưu trữ', 'Confirm archive')}
              </Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
function UsersPanel({
  token,
  actorId,
  revision,
  roles,
  page,
  total,
  onPage,
  disabled,
  run,
}: {
  token: string;
  actorId: string;
  revision: number;
  roles: Role[];
  page: number;
  total: number;
  onPage: (n: number) => void;
  disabled: boolean;
  run: Run;
}) {
  const { t, locale } = useLocale();
  const [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [searchRevision, setSearchRevision] = useState(0),
    [userPage, setUserPage] = useState(1),
    [results, setResults] = useState<z.infer<
      ReturnType<typeof paged<typeof userSummarySchema>>
    > | null>(null),
    [selectedId, setSelectedId] = useState(''),
    [loadedUser, setLoadedUser] = useState<{ value: RbacUser; revision: number } | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [intent, setIntent] = useState<{ role: Role; grant: boolean } | null>(null),
    [reason, setReason] = useState('');
  const user =
    loadedUser?.value.id === selectedId && loadedUser.revision === revision
      ? loadedUser.value
      : null;
  useEffect(() => {
    if (!query) return;
    const ctrl = new AbortController();
    void rbacRequest(
      token,
      `/users?search=${encodeURIComponent(query)}&page=${userPage}`,
      paged(userSummarySchema),
      { signal: ctrl.signal },
    )
      .then((v) => {
        if (!ctrl.signal.aborted) setResults(v);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) {
          setResults(null);
          setError(rbacError(e, locale === 'en'));
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [query, userPage, token, revision, searchRevision, locale]);
  useEffect(() => {
    if (!selectedId) return;
    const ctrl = new AbortController();
    void rbacRequest(token, `/users/${selectedId}`, userSchema, { signal: ctrl.signal })
      .then((v) => {
        if (!ctrl.signal.aborted) {
          setLoadedUser({ value: v, revision });
          setIntent(null);
          setReason('');
          setError('');
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(rbacError(e, locale === 'en'));
      });
    return () => ctrl.abort();
  }, [selectedId, token, revision, locale]);
  const own = selectedId === actorId;
  const eligible = roles
    .filter(
      (r) =>
        r.code === 'ADMIN' ||
        (!r.system && user?.roles.some((base) => base.system && base.code === r.baseRole)),
    )
    .filter((r) => !user?.roles.some((assigned) => assigned.id === r.id));
  return (
    <div className="rbac-columns">
      <section className="rbac-card">
        <h2>{t('Tìm người dùng', 'Find a user')}</h2>
        <form
          className="rbac-search"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
            setUserPage(1);
            setLoading(true);
            setSearchRevision((n) => n + 1);
            setError('');
          }}
        >
          <label>
            {t('Tên hiển thị hoặc User ID', 'Display name or user ID')}
            <input
              required
              minLength={1}
              maxLength={120}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <Button variant="outline" type="submit" disabled={disabled || loading}>
            {t('Tìm kiếm', 'Search')}
          </Button>
        </form>
        {loading && <p role="status">{t('Đang tìm…', 'Searching…')}</p>}
        {results && (
          <>
            <ul className="rbac-role-list">
              {results.items.map((u) => (
                <li key={u.id}>
                  <Button
                    variant="outline"
                    disabled={disabled}
                    aria-pressed={selectedId === u.id}
                    onClick={() => {
                      if (selectedId !== u.id) {
                        setLoadedUser(null);
                        setSelectedId(u.id);
                      }
                    }}
                  >
                    <span>
                      <strong>{u.displayName}</strong>
                      <small>
                        #{u.id} · {u.status}
                      </small>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
            {!results.total && <p>{t('Không tìm thấy người dùng.', 'No users found.')}</p>}
            <Pager
              page={userPage}
              total={results.total}
              onChange={(v) => {
                setLoading(true);
                setUserPage(v);
              }}
              disabled={disabled || loading}
            />
          </>
        )}
        {error && (
          <p role="alert" className="rbac-alert">
            {error}
          </p>
        )}
      </section>
      <section className="rbac-card">
        <h2>
          {user ? `${user.displayName} · #${user.id}` : t('Quyền của người dùng', 'User access')}
        </h2>
        {!user && (
          <p>
            {t(
              'Chọn một người dùng để xem và quản lý role.',
              'Select a user to view and manage roles.',
            )}
          </p>
        )}
        {user && (
          <>
            <p className="rbac-muted">
              {user.status} ·{' '}
              {user.onboarded
                ? t('Đã hoàn tất đăng ký', 'Registration complete')
                : t('Chưa hoàn tất đăng ký', 'Registration incomplete')}{' '}
              ·{t('phiên bản', 'version')} {user.rolesVersion}
            </p>
            {own && (
              <p className="rbac-alert">
                {t(
                  'Bạn chỉ được xem quyền của mình. Cần Admin khác thực hiện thay đổi.',
                  'Your access is read-only here. Another administrator must make changes.',
                )}
              </p>
            )}
            <ul className="rbac-assigned">
              {user.roles.map((r) => (
                <li key={r.id}>
                  <span>
                    <strong>{r.name}</strong>
                    <small>{r.code}</small>
                  </span>
                  {(!r.system || r.code === 'ADMIN') && (
                    <Button
                      variant="outline"
                      disabled={disabled || own}
                      onClick={() => {
                        setIntent({ role: r, grant: false });
                        setReason('');
                      }}
                    >
                      {t('Thu hồi', 'Revoke')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <details>
              <summary>
                {t('Quyền hiệu lực', 'Effective permissions')} ({user.permissionCodes.length})
              </summary>
              <p className="rbac-code">
                {user.permissionCodes.join(', ') || t('Chưa có quyền', 'No permissions')}
              </p>
            </details>
            <h3>{t('Cấp role', 'Grant role')}</h3>
            <p className="rbac-muted">
              {t(
                'Chọn trong các role của trang hiện tại. Chuyển trang để xem thêm.',
                'Choose from roles on the current page. Change pages to see more.',
              )}
            </p>
            <div className="rbac-grants">
              {eligible.map((r) => (
                <Button
                  variant="outline"
                  key={r.id}
                  disabled={disabled || own || user.status !== 'ACTIVE' || !user.onboarded}
                  onClick={() => {
                    setIntent({ role: r, grant: true });
                    setReason('');
                  }}
                >
                  + {r.name} <small>{r.code}</small>
                </Button>
              ))}
              {!eligible.length && (
                <p>
                  {t('Không có role phù hợp trên trang này.', 'No eligible roles on this page.')}
                </p>
              )}
            </div>
            <Pager page={page} total={total} onChange={onPage} disabled={disabled} />
            {intent && (
              <form
                className="rbac-confirm"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run({
                    path: `/users/${user.id}/roles/${intent.role.id}`,
                    method: intent.grant ? 'PUT' : 'DELETE',
                    body: {
                      rolesVersion: user.rolesVersion,
                      roleVersion: intent.role.version,
                      reason,
                    },
                  });
                }}
              >
                <h3>
                  {intent.grant ? t('Cấp', 'Grant') : t('Thu hồi', 'Revoke')} {intent.role.code}
                </h3>
                {intent.role.code === 'ADMIN' && (
                  <p className="rbac-alert">
                    {t(
                      'ADMIN có quyền duyệt, hỗ trợ và quản trị phân quyền cho người khác. Hãy kiểm tra đúng User',
                      'ADMIN can review, provide support, and manage access for others. Verify the target user',
                    )}{' '}
                    #{user.id}.
                  </p>
                )}
                <p>
                  {t('Permission của role:', 'Role permissions:')}{' '}
                  <span className="rbac-code">
                    {intent.role.permissionCodes.join(', ') ||
                      t('Chưa có permission', 'No permissions')}
                  </span>
                </p>
                {!intent.grant && (
                  <p>
                    {t(
                      'Quyền vẫn còn nếu được cấp từ role khác.',
                      'Permissions may remain if granted by another role.',
                    )}
                  </p>
                )}
                <fieldset disabled={disabled || own}>
                  <label>
                    {t('Lý do', 'Reason')}
                    <textarea
                      required
                      minLength={5}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="rbac-actions">
                    <Button
                      variant="primary"
                      type="submit"
                      className={intent.grant ? 'rbac-primary' : 'rbac-danger'}
                    >
                      {t('Xác nhận', 'Confirm')}{' '}
                      {intent.grant ? t('cấp role', 'grant') : t('thu hồi', 'revoke')}
                    </Button>
                    <Button variant="outline" type="button" onClick={() => setIntent(null)}>
                      {t('Hủy', 'Cancel')}
                    </Button>
                  </div>
                </fieldset>
              </form>
            )}
          </>
        )}
      </section>
    </div>
  );
}
function AuditPanel({ token, revision }: { token: string; revision: number }) {
  const { t, locale } = useLocale();
  const [page, setPage] = useState(1),
    [data, setData] = useState<z.infer<ReturnType<typeof paged<typeof auditSchema>>> | null>(null),
    [error, setError] = useState(''),
    [filter, setFilter] = useState({ userId: '', roleId: '' }),
    [draft, setDraft] = useState(filter);
  useEffect(() => {
    const ctrl = new AbortController();
    const signal = ctrl.signal;
    const params = new URLSearchParams({ page: String(page) });
    if (filter.userId) params.set('userId', filter.userId);
    if (filter.roleId) params.set('roleId', filter.roleId);
    void rbacRequest(token, `/audit?${params}`, paged(auditSchema), { signal })
      .then((v) => {
        if (!signal.aborted) {
          setData(v);
          setError('');
        }
      })
      .catch((e) => {
        if (!signal.aborted) {
          setData(null);
          setError(rbacError(e, locale === 'en'));
        }
      });
    return () => ctrl.abort();
  }, [token, page, filter, revision, locale]);
  return (
    <section className="rbac-card">
      <h2>{t('Lịch sử thay đổi quyền', 'Access change history')}</h2>
      <form
        className="rbac-audit-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setFilter(draft);
          setPage(1);
        }}
      >
        <label>
          User ID
          <input
            inputMode="numeric"
            pattern="[1-9][0-9]{0,18}"
            maxLength={19}
            value={draft.userId}
            onChange={(e) => setDraft((v) => ({ ...v, userId: e.target.value }))}
          />
        </label>
        <label>
          Role ID
          <input
            inputMode="numeric"
            pattern="[1-9][0-9]{0,18}"
            maxLength={19}
            value={draft.roleId}
            onChange={(e) => setDraft((v) => ({ ...v, roleId: e.target.value }))}
          />
        </label>
        <Button variant="outline" type="submit">
          {t('Lọc lịch sử', 'Filter history')}
        </Button>
      </form>
      {error && (
        <p role="alert" className="rbac-alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">{t('Đang tải lịch sử…', 'Loading history…')}</p>}
      {data && (
        <>
          <div className="rbac-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Thời gian', 'Time')}</th>
                  <th>Admin</th>
                  <th>{t('Thay đổi', 'Change')}</th>
                  <th>{t('Lý do và chi tiết', 'Reason and details')}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {new Date(a.createdAt).toLocaleString(locale === 'en' ? 'en-GB' : 'vi-VN')}
                    </td>
                    <td>#{a.actorId}</td>
                    <td>
                      <strong>{a.action}</strong>
                      <small>
                        {a.resourceType} #{a.resourceId} · audit #{a.id}
                      </small>
                    </td>
                    <td>
                      <p>{a.reason}</p>
                      <details>
                        <summary>{t('Xem trước / sau', 'View before / after')}</summary>
                        <pre>{JSON.stringify({ before: a.before, after: a.after }, null, 2)}</pre>
                        <small>Request: {a.requestId}</small>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.total && (
              <p>{t('Chưa có thay đổi phù hợp.', 'No changes match this filter.')}</p>
            )}
          </div>
          <Pager page={page} total={data.total} onChange={setPage} />
        </>
      )}
    </section>
  );
}
