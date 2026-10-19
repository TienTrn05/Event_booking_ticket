import Button from '../../shared/ui/Button';
import { Textarea } from '../../shared/ui/Field';
import { Card } from '../../shared/ui/Page';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { z } from 'zod';
import { useAuthDialog } from '../auth/context/AuthDialogContext';
import { useLocale } from '../../shared/i18n/LocaleContext';
import { formatPrice } from '../../shared/utils/format';
import {
  applicationResultSchema,
  applicationSchema,
  eventGraphSchema,
  reviewDetailSchema,
  reviewSummarySchema,
  workspaceError,
  workspaceGet,
  type OrganizationApplication,
  type EventGraph,
  type ReviewDetail,
  type ReviewSummary,
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
import { useWorkspaceDate } from './useWorkspaceDate';

export function AdminWorkspacePage() {
  const { user, accessToken } = useAuthDialog();
  const { t } = useLocale();
  return (
    <main id="main" className="workspace-page">
      <WorkspaceHeading
        eyebrow="Administration"
        title={t('Trung tâm quản trị', 'Administration center')}
        description={t(
          'Xét duyệt có căn cứ. Thay đổi luôn được ghi nhận.',
          'Review with context. Keep every decision accountable.',
        )}
      />
      {user && accessToken ? (
        <AdminDashboard key={user.id} token={accessToken} />
      ) : (
        <WorkspaceLogin />
      )}
    </main>
  );
}

function AdminDashboard({ token }: { token: string }) {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<'organizations' | 'events'>('organizations');
  const [organizations, setOrganizations] = useState<OrganizationApplication[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [reviews, setReviews] = useState<ReviewSummary[] | null>(null);
  const [errors, setErrors] = useState<{ organizations?: string; events?: string }>({});
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<OrganizationApplication | null>(null);
  const [reviewSelection, setReviewSelection] = useState<ReviewSummary | null>(null);
  const [detail, setDetail] = useState<ReviewDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const mutation = useWorkspaceMutation(token);
  const reload = () => {
    setErrors({});
    setOrganizations(null);
    setReviews(null);
    setSelection(null);
    setReviewSelection(null);
    setDetail(null);
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      workspaceGet(
        token,
        `/admin/organization-applications?status=${status}&page=${page}&pageSize=20`,
        z.object({ items: z.array(applicationSchema), total: z.number().int() }),
        controller.signal,
      ),
      workspaceGet(token, '/admin/event-reviews', z.array(reviewSummarySchema), controller.signal),
    ]).then(([orgResult, reviewResult]) => {
      if (controller.signal.aborted) return;
      setOrganizations(orgResult.status === 'fulfilled' ? orgResult.value.items : []);
      setTotal(orgResult.status === 'fulfilled' ? orgResult.value.total : null);
      setReviews(reviewResult.status === 'fulfilled' ? reviewResult.value : []);
      setErrors({
        ...(orgResult.status === 'rejected'
          ? { organizations: workspaceError(orgResult.reason, locale === 'en') }
          : {}),
        ...(reviewResult.status === 'rejected'
          ? { events: workspaceError(reviewResult.reason, locale === 'en') }
          : {}),
      });
    });
    return () => controller.abort();
  }, [token, status, page, revision, locale]);
  useEffect(() => {
    if (!reviewSelection) return;
    const controller = new AbortController();
    void workspaceGet(
      token,
      `/admin/event-reviews/${reviewSelection.id}`,
      reviewDetailSchema,
      controller.signal,
    )
      .then((loaded) => {
        if (!controller.signal.aborted) setDetail(loaded);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setDetailError(workspaceError(cause, locale === 'en'));
      });
    return () => controller.abort();
  }, [token, reviewSelection, locale]);
  return (
    <>
      <div className="workspace-metrics">
        <div className="workspace-metric">
          <Building2 aria-hidden="true" />
          <strong>{total ?? '—'}</strong>
          <span>
            {status === 'PENDING_REVIEW'
              ? t('Hồ sơ tổ chức chờ duyệt', 'Organizations awaiting review')
              : t('Hồ sơ theo bộ lọc', 'Applications matching filter')}
          </span>
        </div>
        <div className="workspace-metric">
          <CalendarCheck2 aria-hidden="true" />
          <strong>{errors.events || !reviews ? '—' : reviews.length}</strong>
          <span>{t('Hồ sơ sự kiện trong hàng đợi', 'Event reviews in this queue')}</span>
        </div>
        <Link to="/admin/rbac" className="workspace-metric" style={{ textDecoration: 'none' }}>
          <ShieldCheck aria-hidden="true" />
          <strong className="text-lg">RBAC</strong>
          <span className="flex items-center gap-2">
            {t('Quản lý vai trò và quyền', 'Manage roles and permissions')}
            <ArrowRight size={14} aria-hidden="true" />
          </span>
        </Link>
      </div>
      <div className="workspace-grid">
        <div className="workspace-stack">
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <div>
                <h2>{t('Hàng đợi xét duyệt', 'Review queue')}</h2>
                <p>
                  {t(
                    'Đọc hồ sơ trước khi quyết định; nhập lý do để lưu cùng thay đổi.',
                    'Read each submission and record a reason with your decision.',
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={reload}
                disabled={mutation.locked}
                aria-label={t('Tải lại hàng đợi', 'Reload queue')}
              >
                <RefreshCw size={16} aria-hidden="true" />
              </Button>
            </div>
            <nav className="workspace-tabs" aria-label={t('Loại hồ sơ', 'Application type')}>
              <Button
                variant="outline"
                aria-current={tab === 'organizations' ? 'page' : undefined}
                disabled={mutation.locked}
                onClick={() => setTab('organizations')}
              >
                <Building2 size={15} aria-hidden="true" />
                {t('Tổ chức', 'Organizations')}
              </Button>
              <Button
                variant="outline"
                aria-current={tab === 'events' ? 'page' : undefined}
                disabled={mutation.locked}
                onClick={() => setTab('events')}
              >
                <CalendarCheck2 size={15} aria-hidden="true" />
                {t('Sự kiện', 'Events')}
              </Button>
            </nav>
            {tab === 'organizations' ? (
              <>
                <label className="mb-5 max-w-xs">
                  {t('Trạng thái hồ sơ', 'Application status')}
                  <select
                    value={status}
                    disabled={mutation.locked}
                    onChange={(event) => {
                      setStatus(event.target.value);
                      setPage(1);
                      setSelection(null);
                      setOrganizations(null);
                      setTotal(null);
                    }}
                  >
                    <option value="PENDING_REVIEW">{t('Chờ duyệt', 'Pending review')}</option>
                    <option value="APPROVED">{t('Đã duyệt', 'Approved')}</option>
                    <option value="REJECTED">{t('Bị từ chối', 'Rejected')}</option>
                    <option value="SUSPENDED">{t('Tạm ngưng', 'Suspended')}</option>
                  </select>
                </label>
                {errors.organizations ? (
                  <WorkspaceError message={errors.organizations} retry={reload} />
                ) : !organizations ? (
                  <WorkspaceLoading />
                ) : organizations.length ? (
                  <ul className="workspace-list">
                    {organizations.map((org) => (
                      <li key={org.id}>
                        <div className="workspace-list-heading">
                          <div>
                            <strong>{org.name}</strong>
                            <p>
                              #{org.id} · v{org.version}
                            </p>
                          </div>
                          <WorkspaceStatus value={org.status} />
                        </div>
                        {org.status === 'PENDING_REVIEW' && (
                          <div className="workspace-actions">
                            <Button
                              variant="outline"
                              disabled={mutation.locked}
                              onClick={() => setSelection(org)}
                            >
                              {t('Xem xét hồ sơ', 'Review application')}
                              <ArrowRight size={14} aria-hidden="true" />
                            </Button>
                          </div>
                        )}
                        {selection?.id === org.id && (
                          <div className="workspace-review-detail">
                            <DecisionForm
                              locked={mutation.locked}
                              reasonMax={2000}
                              onDecision={(approve, reason) =>
                                mutation.start({
                                  path: `/admin/organization-applications/${org.id}/${approve ? 'approve' : 'reject'}`,
                                  body: { version: org.version, reason },
                                  schema: z.object({ data: applicationResultSchema }),
                                  onSuccess: reload,
                                })
                              }
                            />
                            <p className="workspace-muted">
                              {t(
                                'Duyệt tổ chức cần phiên đăng nhập mới trong 5 phút.',
                                'Organization approval requires authentication within 5 minutes.',
                              )}
                            </p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <WorkspaceEmpty
                    title={t(
                      'Không còn hồ sơ trong bộ lọc này',
                      'No applications match this filter',
                    )}
                  >
                    {t(
                      'Hồ sơ mới sẽ xuất hiện tại đây khi được gửi.',
                      'New applications will appear here after submission.',
                    )}
                  </WorkspaceEmpty>
                )}
                {total !== null && total > 20 && (
                  <nav
                    className="workspace-actions"
                    aria-label={t('Phân trang tổ chức', 'Organization pages')}
                  >
                    <Button
                      variant="outline"
                      disabled={mutation.locked || page === 1}
                      onClick={() => {
                        setPage((value) => value - 1);
                        setOrganizations(null);
                        setSelection(null);
                      }}
                    >
                      {t('Trước', 'Previous')}
                    </Button>
                    <span className="workspace-muted">
                      {page} / {Math.ceil(total / 20)}
                    </span>
                    <Button
                      variant="outline"
                      disabled={mutation.locked || page * 20 >= total}
                      onClick={() => {
                        setPage((value) => value + 1);
                        setOrganizations(null);
                        setSelection(null);
                      }}
                    >
                      {t('Sau', 'Next')}
                    </Button>
                  </nav>
                )}
              </>
            ) : errors.events ? (
              <WorkspaceError message={errors.events} retry={reload} />
            ) : !reviews ? (
              <WorkspaceLoading />
            ) : reviews.length ? (
              <ul className="workspace-list">
                {reviews.map((review) => (
                  <li key={review.id}>
                    <div className="workspace-list-heading">
                      <div>
                        <strong>{review.title}</strong>
                        <p>
                          {review.organization} · #{review.id}
                        </p>
                      </div>
                      <WorkspaceStatus value={review.status} />
                    </div>
                    <ReviewDeadline expiresAt={review.expires_at} />
                    <div className="workspace-actions">
                      <Button
                        variant="outline"
                        disabled={mutation.locked}
                        onClick={() => {
                          setDetail(null);
                          setDetailError('');
                          setReviewSelection(review);
                        }}
                      >
                        {t('Đọc bản gửi duyệt', 'Read submission')}
                        <ArrowRight size={14} aria-hidden="true" />
                      </Button>
                    </div>
                    {reviewSelection?.id === review.id && (
                      <div className="workspace-review-detail">
                        {detailError ? (
                          <WorkspaceError
                            message={detailError}
                            retry={() => {
                              setDetailError('');
                              setReviewSelection({ ...review });
                            }}
                          />
                        ) : !detail ? (
                          <WorkspaceLoading />
                        ) : (
                          <>
                            <ReviewSnapshot detail={detail} />
                            <DecisionForm
                              locked={mutation.locked || detail.status !== 'PENDING'}
                              reasonMax={4000}
                              guidance
                              onDecision={(approve, reason, guidance) =>
                                mutation.start({
                                  path: `/admin/event-reviews/${detail.id}/${approve ? 'approve' : 'reject'}`,
                                  body: {
                                    version: detail.event_version,
                                    reason,
                                    guidance: guidance ?? '',
                                    ...(!approve ? { reasonCode: 'REVIEW_REJECTED' } : {}),
                                  },
                                  schema: z.object({ data: eventGraphSchema }),
                                  onSuccess: reload,
                                })
                              }
                            />
                          </>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <WorkspaceEmpty title={t('Hàng đợi sự kiện đã trống', 'The event queue is clear')}>
                {t(
                  'Các bản gửi duyệt mới sẽ xuất hiện tại đây.',
                  'New submissions will appear here.',
                )}
              </WorkspaceEmpty>
            )}
          </Card>
        </div>
        <aside className="workspace-stack">
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>{t('Công cụ quản trị', 'Administration tools')}</h2>
              <ClipboardList size={20} aria-hidden="true" />
            </div>
            <ul className="workspace-list">
              <li>
                <Link className="workspace-inline-link" to="/admin/rbac">
                  {t('Vai trò và phân quyền', 'Roles and permissions')} →
                </Link>
                <p>
                  {t(
                    'Role bổ sung, gán quyền và audit thay đổi.',
                    'Additional roles, assignments, and change audit.',
                  )}
                </p>
              </li>
              <li>
                <Link className="workspace-inline-link" to="/admin/onboarding">
                  {t('Câu hỏi đăng ký', 'Registration questions')} →
                </Link>
                <p>
                  {t(
                    'Quản lý câu hỏi bổ sung theo phiên bản.',
                    'Manage versioned additional registration questions.',
                  )}
                </p>
              </li>
            </ul>
          </Card>
          <div className="workspace-note">
            <p>
              {t(
                'Mỗi công cụ yêu cầu quyền riêng. Điều hướng vào khu vực quản trị không tự cấp quyền xem hoặc thay đổi dữ liệu.',
                'Each tool requires its own permission. Opening this workspace does not grant access to data or changes.',
              )}
            </p>
          </div>
        </aside>
      </div>
      <MutationNotice mutation={mutation} />
    </>
  );
}

function DecisionForm({
  locked,
  reasonMax,
  guidance,
  onDecision,
}: {
  locked: boolean;
  reasonMax: number;
  guidance?: boolean;
  onDecision: (approve: boolean, reason: string, guidance?: string) => void;
}) {
  const { t } = useLocale();
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const fields = new FormData(event.currentTarget);
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        const approve = submitter instanceof HTMLButtonElement && submitter.value === 'approve';
        onDecision(
          approve,
          String(fields.get('reason')).trim(),
          String(fields.get('guidance') ?? '').trim(),
        );
      }}
    >
      <fieldset className="workspace-form" disabled={locked}>
        <Textarea
          label={t('Lý do quyết định', 'Decision reason')}
          name="reason"
          required
          minLength={1}
          maxLength={reasonMax}
          rows={3}
        />
        {guidance && (
          <Textarea
            label={t(
              'Hướng dẫn cho nhà tổ chức (không bắt buộc)',
              'Guidance for the organizer (optional)',
            )}
            name="guidance"
            maxLength={2000}
            rows={2}
          />
        )}
        <label className="workspace-checkbox">
          <input type="checkbox" required />
          {t('Tôi đã đọc và kiểm tra hồ sơ này.', 'I have read and checked this submission.')}
        </label>
        <div className="workspace-actions">
          <Button
            variant="primary"
            name="decision"
            value="approve"
            type="submit"
            className="workspace-primary"
          >
            {t('Phê duyệt', 'Approve')}
          </Button>
          <Button
            variant="outline"
            name="decision"
            value="reject"
            type="submit"
            className="workspace-danger"
          >
            {t('Từ chối', 'Reject')}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function ReviewDeadline({ expiresAt }: { expiresAt: string }) {
  const { t } = useLocale();
  const date = useWorkspaceDate();
  return (
    <p>
      {t('Hạn xét duyệt', 'Review deadline')}: {date(expiresAt)}
    </p>
  );
}

function ReviewSnapshot({ detail }: { detail: ReviewDetail }) {
  const { t } = useLocale();
  const date = useWorkspaceDate();
  const { event, sessions, layouts, seats, zones, ticketTypes } = detail.snapshot_json;
  return (
    <article>
      <h3>{event.title}</h3>
      <p className="workspace-muted">
        {t('Bản gửi', 'Submission')} v{detail.event_version} ·{' '}
        {event.ticketing_mode === 'NUMBERED'
          ? t('Ghế đánh số', 'Numbered seats')
          : t('Theo khu và sức chứa', 'Zones and capacity')}
      </p>
      {event.cover_image_url && (
        <img className="workspace-cover" src={event.cover_image_url} alt={event.title} />
      )}
      <p className="workspace-description">{event.description}</p>
      <dl>
        <div>
          <dt>{t('Sơ đồ', 'Layouts')}</dt>
          <dd>{layouts.length}</dd>
        </div>
        <div>
          <dt>
            {event.ticketing_mode === 'NUMBERED'
              ? t('Tổng ghế trong các sơ đồ', 'Seats across layouts')
              : t('Tổng khu trong các sơ đồ', 'Zones across layouts')}
          </dt>
          <dd>{event.ticketing_mode === 'NUMBERED' ? seats.length : zones.length}</dd>
        </div>
        <div>
          <dt>{t('Tuổi tối thiểu', 'Minimum age')}</dt>
          <dd>{event.minimum_age ?? t('Không giới hạn', 'No minimum')}</dd>
        </div>
        <div>
          <dt>{t('Loại vé', 'Ticket types')}</dt>
          <dd>{ticketTypes.map((type) => `${type.code} · ${type.name}`).join(', ') || '—'}</dd>
        </div>
      </dl>
      <h3>{t('Lịch các suất diễn', 'Session schedule')}</h3>
      <ul className="workspace-list">
        {sessions.map((session) => (
          <li key={session.id}>
            <strong>{date(session.starts_at, session.timezone)}</strong>
            <p>
              {t('Kết thúc', 'Ends')}: {date(session.ends_at, session.timezone)} ·{' '}
              {session.timezone}
            </p>
            <p>
              {t('Sơ đồ', 'Layout')} #{session.layout_id}
            </p>
            <SnapshotPricing graph={detail.snapshot_json} session={session} />
          </li>
        ))}
      </ul>
      <p className="workspace-note">
        {t(
          'Đây là bản chụp tại thời điểm gửi duyệt, không phải bản nháp đang sửa của tổ chức.',
          'This is the submitted snapshot captured for review.',
        )}
      </p>
    </article>
  );
}

const snapshotPrice = z.object({
  ticketTypeId: z.string().regex(/^[1-9]\d*$/),
  priceMinor: z.string().regex(/^[1-9]\d{0,15}$/),
  currency: z.literal('VND'),
});
const snapshotNumberedPrices = z
  .array(snapshotPrice.extend({ seatId: z.string().regex(/^[1-9]\d*$/) }).strict())
  .min(1);
const snapshotZonePrices = z
  .array(snapshotPrice.extend({ sectionId: z.string().regex(/^[1-9]\d*$/) }).strict())
  .min(1);

function SnapshotPricing({
  graph,
  session,
}: {
  graph: EventGraph;
  session: EventGraph['sessions'][number];
}) {
  const { t } = useLocale();
  const types = graph.ticketTypes.filter((type) => type.session_id === session.id);
  const numbered = graph.event.ticketing_mode === 'NUMBERED';
  const groups = new Map<
    string,
    { ticketType: string; priceMinor: string; currency: string; labels: string[]; capacity: number }
  >();
  let valid: boolean;
  if (numbered) {
    const parsed = snapshotNumberedPrices.safeParse(session.pricing_config);
    const seats = graph.seats.filter((seat) => seat.layout_id === session.layout_id);
    valid =
      parsed.success &&
      parsed.data.length === seats.length &&
      new Set(parsed.data.map((price) => price.seatId)).size === parsed.data.length;
    if (parsed.success)
      for (const price of parsed.data) {
        const seat = seats.find((value) => value.id === price.seatId),
          type = types.find((value) => value.id === price.ticketTypeId);
        if (!seat || !type) {
          valid = false;
          continue;
        }
        const key = `${type.id}:${price.priceMinor}:${price.currency}`;
        const group = groups.get(key) ?? {
          ticketType: `${type.code} · ${type.name}`,
          priceMinor: price.priceMinor,
          currency: price.currency,
          labels: [],
          capacity: 0,
        };
        group.labels.push(`${seat.section} · ${seat.row}-${seat.number}`);
        group.capacity += 1;
        groups.set(key, group);
      }
  } else {
    const parsed = snapshotZonePrices.safeParse(session.pricing_config);
    const zones = graph.zones.filter((zone) => zone.layout_id === session.layout_id);
    valid =
      parsed.success &&
      parsed.data.length === zones.length &&
      new Set(parsed.data.map((price) => price.sectionId)).size === parsed.data.length;
    if (parsed.success)
      for (const price of parsed.data) {
        const zone = zones.find((value) => value.id === price.sectionId),
          type = types.find((value) => value.id === price.ticketTypeId);
        if (!zone || !type) {
          valid = false;
          continue;
        }
        const key = `${type.id}:${price.priceMinor}:${price.currency}`;
        const group = groups.get(key) ?? {
          ticketType: `${type.code} · ${type.name}`,
          priceMinor: price.priceMinor,
          currency: price.currency,
          labels: [],
          capacity: 0,
        };
        group.labels.push(`${zone.code} · ${zone.name} (${zone.capacity})`);
        group.capacity += zone.capacity;
        groups.set(key, group);
      }
  }
  if (!valid)
    return (
      <p className="workspace-alert">
        {t(
          'Không thể đọc đầy đủ giá và phân bổ vé trong bản gửi. Hãy kiểm tra hồ sơ trước khi quyết định.',
          'The submitted ticket prices or allocations are unavailable. Check the submission before making a decision.',
        )}
      </p>
    );
  return (
    <div className="workspace-table-wrap">
      <table className="workspace-table">
        <caption className="sr-only">
          {t('Bảng giá trong bản gửi duyệt', 'Submitted ticket pricing')}
        </caption>
        <thead>
          <tr>
            <th>{t('Loại vé', 'Ticket type')}</th>
            <th>
              {numbered
                ? t('Phân bổ ghế', 'Seat allocation')
                : t('Khu và sức chứa', 'Zones and capacity')}
            </th>
            <th>{t('Giá mỗi vé', 'Price per ticket')}</th>
          </tr>
        </thead>
        <tbody>
          {Array.from(groups, ([key, group]) => (
            <tr key={key}>
              <td>{group.ticketType}</td>
              <td>
                <details>
                  <summary>
                    {numbered
                      ? `${group.labels.length} ${t('ghế', 'seats')}`
                      : `${group.labels.length} ${t('khu', 'zones')} · ${group.capacity} ${t('chỗ', 'places')}`}
                  </summary>
                  <p>{group.labels.join(', ')}</p>
                </details>
              </td>
              <td>
                <data value={group.priceMinor} data-currency={group.currency}>
                  {formatPrice(group.priceMinor, group.currency)}{' '}
                  <span className="workspace-muted">{group.currency}</span>
                </data>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
