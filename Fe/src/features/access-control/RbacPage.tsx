import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Users, History, Plus, RefreshCw, LockKeyhole } from 'lucide-react';
import { z } from 'zod';
import { useAuthDialog } from '../auth/context/AuthDialogContext';
import { ApiError } from '../../shared/api/client';
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
  return (
    <main id="main" className="rbac-page">
      <header className="rbac-heading">
        <span className="rbac-eyebrow">QUẢN TRỊ HỆ THỐNG</span>
        <h1>
          <ShieldCheck aria-hidden="true" />
          Phân quyền truy cập
        </h1>
        <p>Quản lý vai trò, quyền được cấp và lịch sử thay đổi.</p>
        <Link to="/admin/onboarding">Quản lý câu hỏi đăng ký →</Link>
      </header>
      {accessToken && user ? (
        <Manager key={accessToken} token={accessToken} actorId={user.id} />
      ) : (
        <section className="rbac-card">
          <LockKeyhole aria-hidden="true" />
          <h2>Đăng nhập Admin để tiếp tục</h2>
          <p>Trang này yêu cầu quyền quản trị phân quyền.</p>
          <button onClick={() => openAuth('login')}>Đăng nhập</button>
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
  return (
    <nav className="rbac-pager" aria-label="Phân trang">
      <button disabled={disabled || page === 1} onClick={() => onChange(page - 1)}>
        Trước
      </button>
      <span>
        Trang {page} / {Math.max(1, Math.ceil(total / size))} · {total} kết quả
      </span>
      <button disabled={disabled || page * size >= total} onClick={() => onChange(page + 1)}>
        Sau
      </button>
    </nav>
  );
}
function Manager({ token, actorId }: { token: string; actorId: string }) {
  const { logout } = useAuthDialog();
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
          setError(rbacError(e));
          setReauth(e instanceof ApiError && e.status === 401);
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [token, page, revision]);
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
      setUncertain(false);
      setNotice(`Đã lưu thay đổi. Mã audit #${change.auditId}.`);
      setLoading(true);
      setRevision((n) => n + 1);
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status < 500 && e.code !== 'REQUEST_IN_PROGRESS') {
        pending.current = null;
        setUncertain(false);
        setError(rbacError(e));
        setReauth(e.status === 401);
      } else {
        setUncertain(true);
        setError('Chưa xác nhận được kết quả. Thử lại đúng yêu cầu đang chờ bằng nút bên dưới.');
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
          Role bổ sung <strong>cộng quyền</strong> với role gốc. Chỉ cấp trong cùng nhóm. Thay đổi
          quyền cần đăng nhập trong 5 phút và lý do; không được tự sửa quyền của mình.
        </p>
      </div>
      <div className="rbac-toolbar">
        <nav aria-label="Chức năng phân quyền">
          {(
            [
              { id: 'roles', label: 'Vai trò', Icon: ShieldCheck },
              { id: 'users', label: 'Người dùng', Icon: Users },
              { id: 'audit', label: 'Lịch sử', Icon: History },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              disabled={busy || uncertain}
              onClick={() => setTab(id)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <button
          disabled={busy || uncertain}
          onClick={() => {
            setLoading(true);
            setRevision((n) => n + 1);
          }}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Tải lại
        </button>
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
          <button disabled={busy || uncertain} onClick={() => void logout()}>
            Đăng xuất để đăng nhập lại
          </button>{' '}
          Phiên hiện tại sẽ kết thúc; đăng nhập mới để tiếp tục.
        </p>
      )}
      {uncertain && (
        <button
          disabled={busy}
          onClick={() => {
            if (pending.current) void execute(pending.current);
          }}
        >
          Thử lại yêu cầu đang chờ
        </button>
      )}
      {loading && <p role="status">Đang tải dữ liệu…</p>}
      {ready && tab === 'roles' && (
        <div className="rbac-columns">
          <section className="rbac-card">
            <div className="rbac-section-heading">
              <h2>Danh sách vai trò</h2>
              <button disabled={disabled} onClick={() => setSelected(null)}>
                <Plus size={16} aria-hidden="true" />
                Tạo role
              </button>
            </div>
            <ul className="rbac-role-list">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
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
                        ? 'Hệ thống'
                        : r.status === 'ARCHIVED'
                          ? 'Đã lưu trữ'
                          : `${r.userCount} người`}
                    </span>
                  </button>
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
      <h2>{role ? role.name : 'Tạo vai trò bổ sung'}</h2>
      {immutable && (
        <p className="rbac-muted">
          {role.system
            ? 'Role hệ thống được bảo vệ. Các quyền bên dưới chỉ để xem.'
            : 'Role đã lưu trữ, giữ lại để tra cứu lịch sử.'}
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
              Mã role{' '}
              <span className="rbac-inline">
                <span>CUSTOM_</span>
                <input
                  aria-label="Mã role"
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
            Tên vai trò
            <input
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Mô tả
            <textarea
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            Nhóm role gốc
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
            User phải có role gốc tương ứng. Role bổ sung không giảm quyền đã có hoặc thay thế quyền
            sở hữu và thành viên tổ chức.
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
                Lý do thay đổi
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Nêu mục đích và phạm vi cấp quyền"
                />
              </label>
              <button className="rbac-primary" type="submit">
                {role ? 'Lưu thay đổi' : 'Tạo role'}
              </button>
            </>
          )}
        </fieldset>
      </form>
      {role && !immutable && (
        <div className="rbac-archive">
          <button disabled={disabled || role.userCount > 0} onClick={() => setArchive((v) => !v)}>
            Lưu trữ role
          </button>
          {role.userCount > 0 && <p>Thu hồi {role.userCount} lượt gán trước khi lưu trữ.</p>}
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
                Lý do lưu trữ
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  disabled={disabled}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <button className="rbac-danger" disabled={disabled}>
                Xác nhận lưu trữ
              </button>
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
          setError(rbacError(e));
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [query, userPage, token, revision, searchRevision]);
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
        if (!ctrl.signal.aborted) setError(rbacError(e));
      });
    return () => ctrl.abort();
  }, [selectedId, token, revision]);
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
        <h2>Tìm người dùng</h2>
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
            Tên hiển thị hoặc User ID
            <input
              required
              minLength={1}
              maxLength={120}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button disabled={disabled || loading}>Tìm kiếm</button>
        </form>
        {loading && <p role="status">Đang tìm…</p>}
        {results && (
          <>
            <ul className="rbac-role-list">
              {results.items.map((u) => (
                <li key={u.id}>
                  <button
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
                  </button>
                </li>
              ))}
            </ul>
            {!results.total && <p>Không tìm thấy người dùng.</p>}
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
        <h2>{user ? `${user.displayName} · #${user.id}` : 'Quyền của người dùng'}</h2>
        {!user && <p>Chọn một người dùng để xem và quản lý role.</p>}
        {user && (
          <>
            <p className="rbac-muted">
              {user.status} · {user.onboarded ? 'Đã hoàn tất đăng ký' : 'Chưa hoàn tất đăng ký'} ·
              phiên bản {user.rolesVersion}
            </p>
            {own && (
              <p className="rbac-alert">
                Bạn chỉ được xem quyền của mình. Cần Admin khác thực hiện thay đổi.
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
                    <button
                      disabled={disabled || own}
                      onClick={() => {
                        setIntent({ role: r, grant: false });
                        setReason('');
                      }}
                    >
                      Thu hồi
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <details>
              <summary>Quyền hiệu lực ({user.permissionCodes.length})</summary>
              <p className="rbac-code">{user.permissionCodes.join(', ') || 'Chưa có quyền'}</p>
            </details>
            <h3>Cấp role</h3>
            <p className="rbac-muted">
              Chọn trong các role của trang hiện tại. Chuyển trang để xem thêm.
            </p>
            <div className="rbac-grants">
              {eligible.map((r) => (
                <button
                  key={r.id}
                  disabled={disabled || own || user.status !== 'ACTIVE' || !user.onboarded}
                  onClick={() => {
                    setIntent({ role: r, grant: true });
                    setReason('');
                  }}
                >
                  + {r.name} <small>{r.code}</small>
                </button>
              ))}
              {!eligible.length && <p>Không có role phù hợp trên trang này.</p>}
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
                  {intent.grant ? 'Cấp' : 'Thu hồi'} {intent.role.code}
                </h3>
                {intent.role.code === 'ADMIN' && (
                  <p className="rbac-alert">
                    ADMIN có quyền duyệt, hỗ trợ và quản trị phân quyền cho người khác. Hãy kiểm tra
                    đúng User #{user.id}.
                  </p>
                )}
                <p>
                  Permission của role:{' '}
                  <span className="rbac-code">
                    {intent.role.permissionCodes.join(', ') || 'Chưa có permission'}
                  </span>
                </p>
                {!intent.grant && <p>Quyền vẫn còn nếu được cấp từ role khác.</p>}
                <fieldset disabled={disabled || own}>
                  <label>
                    Lý do
                    <textarea
                      required
                      minLength={5}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="rbac-actions">
                    <button className={intent.grant ? 'rbac-primary' : 'rbac-danger'}>
                      Xác nhận {intent.grant ? 'cấp role' : 'thu hồi'}
                    </button>
                    <button type="button" onClick={() => setIntent(null)}>
                      Hủy
                    </button>
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
          setError(rbacError(e));
        }
      });
    return () => ctrl.abort();
  }, [token, page, filter, revision]);
  return (
    <section className="rbac-card">
      <h2>Lịch sử thay đổi quyền</h2>
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
        <button>Lọc lịch sử</button>
      </form>
      {error && (
        <p role="alert" className="rbac-alert">
          {error}
        </p>
      )}
      {!data && !error && <p role="status">Đang tải lịch sử…</p>}
      {data && (
        <>
          <div className="rbac-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Admin</th>
                  <th>Thay đổi</th>
                  <th>Lý do và chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>{new Date(a.createdAt).toLocaleString('vi-VN')}</td>
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
                        <summary>Xem trước / sau</summary>
                        <pre>{JSON.stringify({ before: a.before, after: a.after }, null, 2)}</pre>
                        <small>Request: {a.requestId}</small>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.total && <p>Chưa có thay đổi phù hợp.</p>}
          </div>
          <Pager page={page} total={data.total} onChange={setPage} />
        </>
      )}
    </section>
  );
}
