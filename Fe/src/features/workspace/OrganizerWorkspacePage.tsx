import Button from '../../shared/ui/Button';
import { Input, Select, Textarea } from '../../shared/ui/Field';
import { Card } from '../../shared/ui/Page';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  FilePlus2,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { z } from 'zod';
import { useAuthDialog } from '../auth/context/AuthDialogContext';
import { useLocale } from '../../shared/i18n/LocaleContext';
import {
  applicationResultSchema,
  applicationSchema,
  eventGraphSchema,
  eventSummarySchema,
  membershipSchema,
  optionsSchema,
  workspaceError,
  workspaceGet,
  type EventOptions,
  type EventSummary,
  type OrganizationApplication,
  type OrganizationMembership,
} from './workspace.api';
import { useWorkspaceMutation } from './useWorkspaceMutation';
import {
  MutationNotice,
  WorkspaceEmpty,
  WorkspaceError,
  WorkspaceHeading,
  WorkspaceLoading,
  WorkspaceLogin,
  WorkspaceStatus,
} from './WorkspaceParts';

export function OrganizerWorkspacePage() {
  const { user, accessToken } = useAuthDialog();
  const { t } = useLocale();
  return (
    <main id="main" className="workspace-page">
      <WorkspaceHeading
        eyebrow="Organizer workspace"
        title={t('Không gian tổ chức', 'Organizer workspace')}
        description={t(
          'Từ ý tưởng đầu tiên đến một sự kiện đáng nhớ.',
          'From the first idea to an event worth remembering.',
        )}
      />
      {user && accessToken ? (
        <OrganizerDashboard key={user.id} token={accessToken} />
      ) : (
        <WorkspaceLogin />
      )}
    </main>
  );
}

function OrganizerDashboard({ token }: { token: string }) {
  const { t, locale } = useLocale();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [eventsAvailable, setEventsAvailable] = useState(false);
  const [applications, setApplications] = useState<OrganizationApplication[]>([]);
  const [memberships, setMemberships] = useState<OrganizationMembership[]>([]);
  const [options, setOptions] = useState<EventOptions | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const mutation = useWorkspaceMutation(token);
  const reload = () => {
    setEvents(null);
    setErrors([]);
    setRevision((v) => v + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      workspaceGet(token, '/organizer/events', z.array(eventSummarySchema), controller.signal),
      workspaceGet(
        token,
        '/organizations/applications',
        z.array(applicationSchema),
        controller.signal,
      ),
      workspaceGet(
        token,
        '/organizer/organizations?page=1&pageSize=100',
        z.object({ items: z.array(membershipSchema) }),
        controller.signal,
      ),
      workspaceGet(token, '/organizer/event-options', optionsSchema, controller.signal),
    ]).then(([eventResult, applicationResult, membershipResult, optionResult]) => {
      if (controller.signal.aborted) return;
      setEvents(eventResult.status === 'fulfilled' ? eventResult.value : []);
      setEventsAvailable(eventResult.status === 'fulfilled');
      setApplications(applicationResult.status === 'fulfilled' ? applicationResult.value : []);
      setMemberships(membershipResult.status === 'fulfilled' ? membershipResult.value.items : []);
      setOptions(optionResult.status === 'fulfilled' ? optionResult.value : null);
      setErrors(
        [eventResult, applicationResult, membershipResult, optionResult]
          .flatMap((result) =>
            result.status === 'rejected' ? [workspaceError(result.reason, locale === 'en')] : [],
          )
          .filter((value, index, all) => all.indexOf(value) === index),
      );
    });
    return () => controller.abort();
  }, [token, revision, locale]);
  const organizations = [...memberships, ...applications].filter(
    (org, i, all) => all.findIndex((other) => other.id === org.id) === i,
  );
  if (events === null) return <WorkspaceLoading />;
  return (
    <>
      {errors.map((error) => (
        <WorkspaceError key={error} message={error} retry={reload} />
      ))}
      {eventsAvailable && (
        <div className="workspace-metrics">
          <div className="workspace-metric">
            <CalendarDays aria-hidden="true" />
            <strong>{events.length}</strong>
            <span>{t('Sự kiện trong danh sách', 'Events in this list')}</span>
          </div>
          <div className="workspace-metric">
            <FilePlus2 aria-hidden="true" />
            <strong>{events.filter((event) => event.status === 'DRAFT').length}</strong>
            <span>{t('Bản nháp đang chuẩn bị', 'Drafts in preparation')}</span>
          </div>
          <div className="workspace-metric">
            <ShieldCheck aria-hidden="true" />
            <strong>{events.filter((event) => event.status === 'PUBLISHED').length}</strong>
            <span>{t('Sự kiện đã công khai', 'Published events')}</span>
          </div>
        </div>
      )}
      <div className="workspace-grid">
        <div className="workspace-stack">
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <div>
                <h2>{t('Sự kiện của bạn', 'Your events')}</h2>
                <p>
                  {t(
                    'Tối đa 100 sự kiện gần nhất trong tổ chức của bạn.',
                    'Up to 100 recent events in your organizations.',
                  )}
                </p>
              </div>
              <div className="workspace-actions" style={{ marginTop: 0 }}>
                <Button
                  variant="outline"
                  aria-label={t('Tải lại', 'Reload')}
                  onClick={reload}
                  disabled={mutation.locked}
                >
                  <RefreshCw size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="primary"
                  className="workspace-primary"
                  onClick={() => setShowCreate((v) => !v)}
                  disabled={mutation.locked || !options || !organizations.length}
                >
                  <Plus size={16} aria-hidden="true" />
                  {t('Tạo sự kiện', 'Create event')}
                </Button>
              </div>
            </div>
            {eventsAvailable &&
              (events.length ? (
                <div className="workspace-table-wrap">
                  <table className="workspace-table">
                    <thead>
                      <tr>
                        <th>{t('Sự kiện', 'Event')}</th>
                        <th>{t('Trạng thái', 'Status')}</th>
                        <th>{t('Hình thức', 'Ticketing')}</th>
                        <th>
                          <span className="sr-only">{t('Thao tác', 'Actions')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.id}>
                          <td>
                            <strong>{event.title}</strong>
                            <small>
                              #{event.id} ·{' '}
                              {organizations.find((org) => org.id === event.organizationId)?.name ??
                                `#${event.organizationId}`}
                            </small>
                          </td>
                          <td>
                            <WorkspaceStatus value={event.status} />
                          </td>
                          <td>
                            {event.ticketingMode === 'NUMBERED'
                              ? t('Ghế đánh số', 'Numbered seats')
                              : t('Theo số lượng', 'By quantity')}
                          </td>
                          <td>
                            <Link
                              to={`/organizer/events/${event.id}`}
                              aria-label={`${t('Quản lý', 'Manage')} ${event.title}`}
                            >
                              <ArrowUpRight size={18} aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <WorkspaceEmpty
                  title={t('Sự kiện đầu tiên đang chờ bạn', 'Your first event starts here')}
                >
                  {t(
                    'Tạo tổ chức, sau đó bắt đầu một bản nháp. Bạn có thể chuẩn bị trước khi hồ sơ được duyệt.',
                    'Create an organization and start a draft. You can prepare while the application is being reviewed.',
                  )}
                </WorkspaceEmpty>
              ))}
          </Card>
          {showCreate && options && (
            <Card className="workspace-card">
              <div className="workspace-card-heading">
                <div>
                  <h2>{t('Bắt đầu một sự kiện mới', 'Start a new event')}</h2>
                  <p>
                    {t(
                      'Bản nháp chỉ bạn và thành viên phù hợp được xem.',
                      'Drafts are visible only to authorized organization members.',
                    )}
                  </p>
                </div>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const fields = new FormData(event.currentTarget);
                  mutation.start({
                    path: '/organizer/events',
                    body: {
                      organizationId: String(fields.get('organizationId')),
                      title: String(fields.get('title')).trim(),
                      categoryId: String(fields.get('categoryId')),
                      description: String(fields.get('description')).trim(),
                      minimumAge: fields.get('minimumAge')
                        ? Number(fields.get('minimumAge'))
                        : null,
                      ticketingMode: String(fields.get('ticketingMode')),
                    },
                    schema: z.object({ data: eventGraphSchema }),
                    onSuccess: (result) => {
                      void navigate(`/organizer/events/${result.data.event.id}`);
                    },
                  });
                }}
              >
                <fieldset disabled={mutation.locked} className="workspace-form">
                  <Input
                    label={t('Tên sự kiện', 'Event title')}
                    name="title"
                    required
                    maxLength={180}
                    placeholder={t(
                      'Đặt tên cho trải nghiệm của bạn',
                      'Give your experience a name',
                    )}
                  />
                  <div className="workspace-form-grid">
                    <Select label={t('Tổ chức', 'Organization')} name="organizationId" required>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </Select>
                    <Select label={t('Danh mục', 'Category')} name="categoryId" required>
                      {options.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <Textarea
                    label={t('Mô tả', 'Description')}
                    name="description"
                    required
                    maxLength={10000}
                    rows={5}
                  />
                  <div className="workspace-form-grid">
                    <label>
                      {t('Hình thức vé', 'Ticketing mode')}
                      <select name="ticketingMode">
                        <option value="NUMBERED">
                          {t('Indoor · Ghế đánh số', 'Indoor · Numbered seats')}
                        </option>
                        <option value="QUANTITY">
                          {t('Outdoor · Khu vực và sức chứa', 'Outdoor · Zones and capacity')}
                        </option>
                      </select>
                      <small>
                        {t(
                          'Hình thức được cố định sau khi tạo.',
                          'The ticketing mode is fixed after creation.',
                        )}
                      </small>
                    </label>
                    <Input
                      label={t('Tuổi tối thiểu (không bắt buộc)', 'Minimum age (optional)')}
                      name="minimumAge"
                      type="number"
                      min={1}
                      max={32767}
                    />
                  </div>
                  <div className="workspace-actions">
                    <Button variant="primary" className="workspace-primary" type="submit">
                      {mutation.busy
                        ? t('Đang tạo…', 'Creating…')
                        : t('Tạo bản nháp', 'Create draft')}
                    </Button>
                    <Button variant="outline" type="button" onClick={() => setShowCreate(false)}>
                      {t('Đóng', 'Close')}
                    </Button>
                  </div>
                </fieldset>
              </form>
            </Card>
          )}
        </div>
        <aside className="workspace-stack">
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>{t('Tổ chức của bạn', 'Your organizations')}</h2>
              <Building2 size={20} aria-hidden="true" />
            </div>
            {organizations.length ? (
              <ul className="workspace-list">
                {organizations.map((org) => (
                  <li key={org.id}>
                    <div className="workspace-list-heading">
                      <strong>{org.name}</strong>
                      {'status' in org ? (
                        <WorkspaceStatus value={org.status} />
                      ) : (
                        <WorkspaceStatus value="APPROVED" />
                      )}
                    </div>
                    {'reviewReason' in org && org.reviewReason && <p>{org.reviewReason}</p>}
                    {'status' in org && org.status === 'REJECTED' && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const fields = new FormData(event.currentTarget);
                          mutation.start({
                            path: `/organizations/applications/${org.id}`,
                            method: 'PATCH',
                            body: { name: String(fields.get('name')).trim(), version: org.version },
                            schema: z.object({ data: applicationResultSchema }),
                            onSuccess: reload,
                          });
                        }}
                      >
                        <fieldset className="workspace-form" disabled={mutation.locked}>
                          <Input
                            label={t('Tên tổ chức gửi lại', 'Resubmission name')}
                            name="name"
                            defaultValue={org.name}
                            maxLength={180}
                            required
                          />
                          <Button variant="outline" type="submit">
                            {t('Gửi lại hồ sơ', 'Resubmit application')}
                          </Button>
                        </fieldset>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <WorkspaceEmpty title={t('Chưa có tổ chức', 'No organizations yet')} />
            )}
          </Card>
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>{t('Tạo tổ chức', 'Create organization')}</h2>
            </div>
            <p className="workspace-muted">
              {t(
                'Gửi hồ sơ để Admin xét duyệt. Bạn có thể tạo sự kiện nháp ngay sau đó.',
                'Submit an application for review. You can start creating event drafts right away.',
              )}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const fields = new FormData(form);
                mutation.start({
                  path: '/organizations/applications',
                  body: { name: String(fields.get('name')).trim() },
                  schema: z.object({ data: applicationResultSchema }),
                  onSuccess: () => {
                    form.reset();
                    reload();
                  },
                });
              }}
            >
              <fieldset className="workspace-form" disabled={mutation.locked}>
                <Input
                  label={t('Tên tổ chức', 'Organization name')}
                  name="name"
                  required
                  maxLength={180}
                  placeholder={t('Tên thương hiệu hoặc đơn vị', 'Your brand or organization')}
                />
                <Button variant="primary" className="workspace-primary" type="submit">
                  <Plus size={16} aria-hidden="true" />
                  {t('Gửi hồ sơ', 'Submit application')}
                </Button>
              </fieldset>
            </form>
          </Card>
          <div className="workspace-note">
            <p>
              {t(
                'Tổ chức và sự kiện cần được Admin duyệt trước khi mở bán. Quyền truy cập được kiểm tra theo từng tổ chức.',
                'Organizations and events require approval before sales can begin. Access is checked for each organization.',
              )}
            </p>
          </div>
        </aside>
      </div>
      <MutationNotice mutation={mutation} />
    </>
  );
}
