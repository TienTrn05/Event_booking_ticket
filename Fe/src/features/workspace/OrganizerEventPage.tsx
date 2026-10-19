import Button from '../../shared/ui/Button';
import { Input, Select, Textarea } from '../../shared/ui/Field';
import { Card } from '../../shared/ui/Page';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ImagePlus,
  Map,
  Plus,
  RefreshCw,
  Send,
  Ticket,
  Undo2,
} from 'lucide-react';
import { z } from 'zod';
import { useAuthDialog } from '../auth/context/AuthDialogContext';
import { ImageUpload } from '../media/components/ImageUpload';
import { useLocale } from '../../shared/i18n/LocaleContext';
import {
  eventGraphSchema,
  idSchema,
  optionsSchema,
  workspaceError,
  workspaceGet,
  type EventGraph,
  type EventOptions,
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

export function OrganizerEventPage() {
  const { eventId } = useParams();
  const { user, accessToken } = useAuthDialog();
  const { t } = useLocale();
  return (
    <main id="main" className="workspace-page">
      <Link to="/organizer" className="workspace-inline-link inline-flex items-center gap-2">
        <ArrowLeft size={15} aria-hidden="true" />
        {t('Tất cả sự kiện', 'All events')}
      </Link>
      {user && accessToken ? (
        eventId && idSchema.safeParse(eventId).success ? (
          <EventEditor key={`${user.id}:${eventId}`} token={accessToken} eventId={eventId} />
        ) : (
          <WorkspaceError message={t('Mã sự kiện không hợp lệ.', 'Invalid event ID.')} />
        )
      ) : (
        <WorkspaceLogin />
      )}
    </main>
  );
}

function EventEditor({ token, eventId }: { token: string; eventId: string }) {
  const { t, locale } = useLocale();
  const date = useWorkspaceDate();
  const [graph, setGraph] = useState<EventGraph | null>(null);
  const [options, setOptions] = useState<EventOptions | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const mutation = useWorkspaceMutation(token);
  const reload = () => {
    setError('');
    setGraph(null);
    setRevision((v) => v + 1);
  };
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      workspaceGet(token, `/organizer/events/${eventId}`, eventGraphSchema, controller.signal),
      workspaceGet(token, '/organizer/event-options', optionsSchema, controller.signal),
    ])
      .then(([loaded, available]) => {
        if (!controller.signal.aborted) {
          setGraph(loaded);
          setOptions(available);
        }
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(workspaceError(cause, locale === 'en'));
      });
    return () => controller.abort();
  }, [eventId, token, revision, locale]);
  if (error) return <WorkspaceError message={error} retry={reload} />;
  if (!graph || !options) return <WorkspaceLoading />;
  const { event } = graph;
  const write = (suffix: string, body: unknown, method: 'POST' | 'PATCH' | 'PUT' = 'POST') =>
    mutation.start({
      path: `/organizer/events/${event.id}${suffix}`,
      method,
      body,
      schema: z.object({ data: eventGraphSchema }),
      onSuccess: (result) => setGraph(result.data),
    });
  const draft = event.status === 'DRAFT';
  const latestPending = graph.reviews.find((review) => review.status === 'PENDING');
  return (
    <>
      <WorkspaceHeading
        eyebrow={t('Cấu hình sự kiện', 'Event setup')}
        title={event.title}
        description={`${t('Bản', 'Version')} ${event.version} · ${event.ticketing_mode === 'NUMBERED' ? t('Indoor · Ghế đánh số', 'Indoor · Numbered seats') : t('Outdoor · Theo khu vực', 'Outdoor · Zones')}`}
        action={
          <div className="workspace-actions">
            <WorkspaceStatus value={event.status} />
            <Button
              variant="outline"
              disabled={mutation.locked}
              onClick={reload}
              aria-label={t('Tải lại sự kiện', 'Reload event')}
            >
              <RefreshCw size={16} aria-hidden="true" />
            </Button>
          </div>
        }
      />
      <MutationNotice mutation={mutation} />
      <div className="workspace-grid">
        <div className="workspace-stack">
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>
                <span className="workspace-step">1</span>
                {t('Thông tin sự kiện', 'Event information')}
              </h2>
            </div>
            <form
              key={`info:${event.version}`}
              onSubmit={(submit) => {
                submit.preventDefault();
                const fields = new FormData(submit.currentTarget);
                write(
                  '',
                  {
                    version: event.version,
                    title: String(fields.get('title')).trim(),
                    categoryId: String(fields.get('categoryId')),
                    description: String(fields.get('description')).trim(),
                    minimumAge: fields.get('minimumAge') ? Number(fields.get('minimumAge')) : null,
                  },
                  'PATCH',
                );
              }}
            >
              <fieldset className="workspace-form" disabled={!draft || mutation.locked}>
                <Input
                  label={t('Tên sự kiện', 'Event title')}
                  name="title"
                  defaultValue={event.title}
                  maxLength={180}
                  required
                />
                <div className="workspace-form-grid">
                  <Select
                    label={t('Danh mục', 'Category')}
                    name="categoryId"
                    defaultValue={event.category_id}
                  >
                    {options.categories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label={t('Tuổi tối thiểu (không bắt buộc)', 'Minimum age (optional)')}
                    type="number"
                    name="minimumAge"
                    min={1}
                    max={32767}
                    defaultValue={event.minimum_age ?? ''}
                  />
                </div>
                <Textarea
                  label={t('Mô tả', 'Description')}
                  name="description"
                  rows={7}
                  defaultValue={event.description}
                  maxLength={10000}
                  required
                />
                {draft && (
                  <div>
                    <Button variant="primary" type="submit" className="workspace-primary">
                      {t('Lưu thông tin', 'Save information')}
                    </Button>
                  </div>
                )}
              </fieldset>
            </form>
          </Card>
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>
                <span className="workspace-step">2</span>
                {t('Địa điểm và sơ đồ', 'Venue and layout')}
              </h2>
              <Map size={20} aria-hidden="true" />
            </div>
            {graph.layouts.length > 0 && (
              <>
                <ul className="workspace-list">
                  {graph.layouts.map((layout) => (
                    <li key={layout.id}>
                      <strong>
                        {options.venues.find((venue) => venue.id === layout.venue_id)?.name ??
                          `#${layout.venue_id}`}
                      </strong>
                      <p>
                        #{layout.id} · {layout.status} ·{' '}
                        {event.ticketing_mode === 'NUMBERED'
                          ? `${graph.seats.filter((seat) => seat.layout_id === layout.id).length} ${t('ghế', 'seats')}`
                          : `${graph.zones.filter((zone) => zone.layout_id === layout.id).length} ${t('khu', 'zones')}`}
                      </p>
                      <SavedLayoutPreview graph={graph} layoutId={layout.id} />
                    </li>
                  ))}
                </ul>
                <p className="workspace-muted">
                  {t(
                    'Sơ đồ đã lưu được giữ theo phiên bản. Tạo sơ đồ mới để dùng cho suất mới.',
                    'Saved layouts keep their own version. Create a new layout for a new session.',
                  )}
                </p>
              </>
            )}
            {draft && (
              <LayoutBuilder
                key={`layout:${event.version}`}
                options={options}
                mode={event.ticketing_mode}
                locked={mutation.locked}
                onSave={(body) =>
                  write(event.ticketing_mode === 'NUMBERED' ? '/layouts' : '/zone-layouts', {
                    version: event.version,
                    ...body,
                  })
                }
              />
            )}
            {!draft && graph.layouts.length === 0 && (
              <WorkspaceEmpty title={t('Chưa có sơ đồ', 'No layouts')} />
            )}
          </Card>
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>
                <span className="workspace-step">3</span>
                {t('Suất diễn và lịch mở bán', 'Sessions and sales windows')}
              </h2>
              <CalendarDays size={20} aria-hidden="true" />
            </div>
            {graph.sessions.length > 0 && (
              <ul className="workspace-list">
                {graph.sessions.map((session) => (
                  <li key={session.id}>
                    <div className="workspace-list-heading">
                      <strong>{date(session.starts_at, session.timezone)}</strong>
                      <span className="workspace-status">#{session.id}</span>
                    </div>
                    <p>
                      {t('Kết thúc', 'Ends')} {date(session.ends_at, session.timezone)} ·{' '}
                      {session.timezone}
                    </p>
                    <p>
                      {session.pricing_config
                        ? t('Đã cấu hình giá', 'Pricing configured')
                        : t('Chưa có giá vé', 'Pricing needed')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {draft && (
              <SessionForm
                graph={graph}
                options={options}
                locked={mutation.locked}
                onSave={(body) => write('/sessions', { version: event.version, ...body })}
              />
            )}
          </Card>
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>
                <span className="workspace-step">4</span>
                {t('Loại vé và giá', 'Ticket types and prices')}
              </h2>
              <Ticket size={20} aria-hidden="true" />
            </div>
            {graph.sessions.length ? (
              <TicketPricing
                key={`pricing:${event.version}`}
                graph={graph}
                locked={!draft || mutation.locked}
                onType={(sessionId, body) =>
                  write(`/sessions/${sessionId}/ticket-types`, { version: event.version, ...body })
                }
                onPrice={(sessionId, prices) =>
                  write(
                    `/sessions/${sessionId}/${event.ticketing_mode === 'NUMBERED' ? 'prices' : 'zone-prices'}`,
                    { version: event.version, prices },
                    'PUT',
                  )
                }
              />
            ) : (
              <WorkspaceEmpty
                title={t(
                  'Thêm suất diễn trước khi cấu hình vé',
                  'Add a session to configure tickets',
                )}
              />
            )}
          </Card>
        </div>
        <aside className="workspace-stack">
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>{t('Ảnh bìa sự kiện', 'Event cover')}</h2>
              <ImagePlus size={20} aria-hidden="true" />
            </div>
            {event.cover_image_url && (
              <img src={event.cover_image_url} alt={event.title} className="workspace-cover" />
            )}
            {draft && !mutation.locked && (
              <ImageUpload
                accessToken={token}
                target={{ purpose: 'event', targetId: event.id, version: event.version }}
                label={t('Tải ảnh bìa', 'Upload cover')}
                onUploaded={(result) =>
                  setGraph((current) =>
                    current
                      ? {
                          ...current,
                          event: {
                            ...current.event,
                            cover_image_url: result.imageUrl,
                            version: result.version ?? current.event.version,
                          },
                        }
                      : current,
                  )
                }
              />
            )}
          </Card>
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>{t('Sẵn sàng gửi duyệt?', 'Ready for review?')}</h2>
            </div>
            <ul className="workspace-list">
              {[
                [Boolean(event.cover_image_url), t('Ảnh bìa sự kiện', 'Event cover')],
                [graph.layouts.length > 0, t('Địa điểm và sơ đồ', 'Venue and layout')],
                [graph.sessions.length > 0, t('Ít nhất một suất diễn', 'At least one session')],
                [
                  graph.sessions.length > 0 &&
                    graph.sessions.every((session) => Boolean(session.pricing_config)),
                  t('Giá vé cho mọi suất', 'Pricing for every session'),
                ],
              ].map(([done, label]) => (
                <li key={String(label)} className="flex items-center gap-3">
                  <CheckCircle2
                    size={16}
                    style={{ color: done ? 'var(--positive)' : 'var(--muted)' }}
                    aria-hidden="true"
                  />
                  <span className="text-xs">
                    {String(label)}
                    <span className="sr-only">
                      {' '}
                      · {done ? t('Đã có', 'Done') : t('Chưa có', 'Needed')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="workspace-muted">
              {t(
                'Gửi duyệt trước suất sớm nhất ít nhất một tháng lịch. Admin kiểm tra bản gửi; chỉ mở bán sau khi được duyệt.',
                'Submit at least one calendar month before the earliest session. Sales begin after approval.',
              )}
            </p>
            <div className="workspace-actions">
              {draft && (
                <Button
                  variant="primary"
                  className="workspace-primary"
                  disabled={mutation.locked}
                  onClick={() => write('/submit', { version: event.version })}
                >
                  <Send size={16} aria-hidden="true" />
                  {t('Gửi duyệt', 'Submit for review')}
                </Button>
              )}
              {event.status === 'REJECTED' && (
                <Button
                  variant="outline"
                  disabled={mutation.locked}
                  onClick={() => write('/reopen', { version: event.version })}
                >
                  <Undo2 size={16} aria-hidden="true" />
                  {t('Mở lại bản nháp', 'Reopen draft')}
                </Button>
              )}
              {latestPending && (
                <Button
                  variant="outline"
                  disabled={mutation.locked}
                  onClick={() =>
                    mutation.start({
                      path: `/organizer/event-reviews/${latestPending.id}/withdraw`,
                      body: { version: latestPending.event_version },
                      schema: z.object({ data: eventGraphSchema }),
                      onSuccess: (result) => setGraph(result.data),
                    })
                  }
                >
                  <Undo2 size={16} aria-hidden="true" />
                  {t('Rút hồ sơ để chỉnh sửa', 'Withdraw to edit')}
                </Button>
              )}
            </div>
          </Card>
          <Card className="workspace-card">
            <div className="workspace-card-heading">
              <h2>{t('Lịch sử gửi duyệt', 'Review history')}</h2>
            </div>
            {graph.reviews.length ? (
              <ul className="workspace-list">
                {graph.reviews.map((review) => (
                  <li key={review.id}>
                    <div className="workspace-list-heading">
                      <strong>
                        #{review.id} · v{review.event_version}
                      </strong>
                      <WorkspaceStatus value={review.status} />
                    </div>
                    <p>{date(review.submitted_at)}</p>
                    <p>
                      {t('Hạn duyệt', 'Review deadline')}: {date(review.expires_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <WorkspaceEmpty title={t('Chưa gửi duyệt', 'No submissions yet')} />
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}

type LayoutBody = {
  venueId: string;
  stage: { x: number; y: number; width: number; height: number };
  blocked: never[];
  seats?: {
    x: number;
    y: number;
    width: number;
    height: number;
    section: string;
    row: string;
    number: string;
  }[];
  zones?: {
    x: number;
    y: number;
    width: number;
    height: number;
    code: string;
    name: string;
    capacity: number;
  }[];
};
const round = (value: number) => Math.round(value * 1000) / 1000;
function LayoutBuilder({
  options,
  mode,
  locked,
  onSave,
}: {
  options: EventOptions;
  mode: 'NUMBERED' | 'QUANTITY';
  locked: boolean;
  onSave: (body: LayoutBody) => void;
}) {
  const { t } = useLocale();
  const [venueId, setVenueId] = useState(options.venues[0]?.id ?? '');
  const [rows, setRows] = useState(5);
  const [columns, setColumns] = useState(10);
  const [section, setSection] = useState('A');
  const [zones, setZones] = useState([{ code: 'A', name: '', capacity: 1 }]);
  const venue = options.venues.find((value) => value.id === venueId);
  const width = venue ? Number(venue.canvasWidth) : 0,
    height = venue ? Number(venue.canvasHeight) : 0;
  const seatCount = rows * columns;
  const capacity =
    mode === 'NUMBERED' ? seatCount : zones.reduce((sum, zone) => sum + zone.capacity, 0);
  const valid = Boolean(
    venue &&
    width > 0 &&
    height > 0 &&
    capacity > 0 &&
    capacity <= venue.maxCapacity &&
    (mode === 'NUMBERED'
      ? seatCount <= 5000 &&
        Number.isInteger(rows) &&
        Number.isInteger(columns) &&
        rows > 0 &&
        columns > 0
      : zones.length <= 100 &&
        capacity <= 100000 &&
        zones.every(
          (zone) =>
            /^[A-Za-z0-9_-]{1,40}$/.test(zone.code) &&
            zone.name.trim() &&
            Number.isInteger(zone.capacity) &&
            zone.capacity > 0,
        ) &&
        new Set(zones.map((zone) => zone.code)).size === zones.length),
  );
  function build(): LayoutBody {
    const stage = {
      x: round(width * 0.1),
      y: round(height * 0.08),
      width: round(width * 0.8),
      height: round(height * 0.12),
    };
    if (mode === 'NUMBERED')
      return {
        venueId,
        stage,
        blocked: [],
        seats: Array.from({ length: Math.min(5000, Math.max(0, seatCount)) }, (_, index) => ({
          section: section.trim(),
          row: String(Math.floor(index / columns) + 1),
          number: String((index % columns) + 1),
          x: round(width * 0.1 + ((index % columns) * width * 0.8) / columns),
          y: round(height * 0.3 + (Math.floor(index / columns) * height * 0.6) / rows),
          width: round((width * 0.6) / columns),
          height: round((height * 0.4) / rows),
        })),
      };
    const cols = Math.ceil(Math.sqrt(zones.length)),
      rowCount = Math.ceil(zones.length / cols);
    return {
      venueId,
      stage,
      blocked: [],
      zones: zones.map((zone, index) => ({
        ...zone,
        name: zone.name.trim(),
        x: round(width * 0.1 + ((index % cols) * width * 0.8) / cols),
        y: round(height * 0.3 + (Math.floor(index / cols) * height * 0.6) / rowCount),
        width: round((width * 0.7) / cols),
        height: round((height * 0.5) / rowCount),
      })),
    };
  }
  const preview = valid ? build() : null;
  return (
    <details open={!options.venues.length || undefined}>
      <summary>
        <Plus size={16} aria-hidden="true" />
        {t('Tạo sơ đồ mới bằng biểu mẫu', 'Create a layout with the form')}
      </summary>
      {!options.venues.length ? (
        <WorkspaceEmpty title={t('Chưa có địa điểm hoạt động', 'No active venues available')} />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) onSave(build());
          }}
        >
          <fieldset className="workspace-form" disabled={locked}>
            <label>
              {t('Địa điểm', 'Venue')}
              <select
                name="layoutVenueId"
                value={venueId}
                onChange={(event) => setVenueId(event.target.value)}
                required
              >
                {options.venues.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name} · {value.city}
                  </option>
                ))}
              </select>
              <small>
                {venue
                  ? `${width} × ${height} · ${t('Sức chứa tối đa', 'Maximum capacity')}: ${venue.maxCapacity}`
                  : ''}
              </small>
            </label>
            {mode === 'NUMBERED' ? (
              <>
                <Input
                  label={t('Tên khu ghế', 'Seat section')}
                  value={section}
                  name="layoutSection"
                  onChange={(event) => setSection(event.target.value)}
                  maxLength={120}
                  required
                />
                <div className="workspace-form-grid">
                  <Input
                    label={t('Số hàng', 'Rows')}
                    type="number"
                    min={1}
                    max={100}
                    value={rows}
                    name="layoutRows"
                    onChange={(event) => setRows(Number(event.target.value))}
                    required
                  />
                  <Input
                    label={t('Số ghế mỗi hàng', 'Seats per row')}
                    type="number"
                    min={1}
                    max={100}
                    value={columns}
                    name="layoutColumns"
                    onChange={(event) => setColumns(Number(event.target.value))}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <ul className="workspace-list">
                  {zones.map((zone, index) => (
                    <li key={index}>
                      <div className="workspace-form">
                        <div className="workspace-form-grid">
                          <Input
                            label={t('Mã khu', 'Zone code')}
                            value={zone.code}
                            pattern="[A-Za-z0-9_-]{1,40}"
                            maxLength={40}
                            required
                            onChange={(event) =>
                              setZones((current) =>
                                current.map((value, i) =>
                                  i === index ? { ...value, code: event.target.value } : value,
                                ),
                              )
                            }
                          />
                          <Input
                            label={t('Tên khu', 'Zone name')}
                            value={zone.name}
                            maxLength={120}
                            required
                            onChange={(event) =>
                              setZones((current) =>
                                current.map((value, i) =>
                                  i === index ? { ...value, name: event.target.value } : value,
                                ),
                              )
                            }
                          />
                        </div>
                        <Input
                          label={t('Sức chứa', 'Capacity')}
                          type="number"
                          min={1}
                          max={100000}
                          value={zone.capacity}
                          required
                          onChange={(event) =>
                            setZones((current) =>
                              current.map((value, i) =>
                                i === index
                                  ? { ...value, capacity: Number(event.target.value) }
                                  : value,
                              ),
                            )
                          }
                        />
                        {zones.length > 1 && (
                          <Button
                            variant="outline"
                            type="button"
                            onClick={() =>
                              setZones((current) => current.filter((_, i) => i !== index))
                            }
                          >
                            {t('Bỏ khu', 'Remove zone')}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  type="button"
                  disabled={zones.length >= 100}
                  onClick={() =>
                    setZones((current) => [
                      ...current,
                      { code: `Z${current.length + 1}`, name: '', capacity: 1 },
                    ])
                  }
                >
                  <Plus size={16} aria-hidden="true" />
                  {t('Thêm khu', 'Add zone')}
                </Button>
              </>
            )}
            {preview && (
              <div className="workspace-layout-preview">
                <svg
                  viewBox={`0 0 ${width} ${height}`}
                  role="img"
                  aria-label={t('Xem trước sơ đồ mới', 'New layout preview')}
                >
                  <rect {...preview.stage} rx={Math.min(width, height) * 0.01} />
                  <text
                    x={width / 2}
                    y={height * 0.155}
                    textAnchor="middle"
                    fontSize={height * 0.04}
                  >
                    {t('SÂN KHẤU', 'STAGE')}
                  </text>
                  {preview.seats?.map((seat, i) => (
                    <rect
                      key={i}
                      x={seat.x}
                      y={seat.y}
                      width={seat.width}
                      height={seat.height}
                      rx={Math.min(seat.width, seat.height) * 0.2}
                    />
                  ))}
                  {preview.zones?.map((zone) => (
                    <g key={zone.code}>
                      <rect
                        x={zone.x}
                        y={zone.y}
                        width={zone.width}
                        height={zone.height}
                        rx={Math.min(width, height) * 0.015}
                      />
                      <text
                        x={zone.x + zone.width / 2}
                        y={zone.y + zone.height / 2}
                        textAnchor="middle"
                        fontSize={Math.min(height * 0.04, zone.height / 4)}
                      >
                        {zone.code} · {zone.capacity}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
            <p className="workspace-muted">
              {capacity}{' '}
              {mode === 'NUMBERED'
                ? t('ghế đánh số', 'numbered seats')
                : t('chỗ theo sức chứa', 'places by capacity')}
              .{' '}
              {t(
                'Sơ đồ cơ bản sắp xếp tự động trong khung địa điểm; máy chủ kiểm tra hình học và sức chứa trước khi lưu.',
                'This basic layout is arranged inside the venue. The server validates geometry and capacity before saving.',
              )}
            </p>
            {!valid && capacity > (venue?.maxCapacity ?? 0) && (
              <p className="workspace-alert">
                {t('Số lượng vượt sức chứa địa điểm.', 'Capacity exceeds the venue limit.')}
              </p>
            )}
            <div>
              <Button
                variant="primary"
                type="submit"
                className="workspace-primary"
                disabled={!valid}
              >
                {t('Lưu sơ đồ', 'Save layout')}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </details>
  );
}

function SessionForm({
  graph,
  options,
  locked,
  onSave,
}: {
  graph: EventGraph;
  options: EventOptions;
  locked: boolean;
  onSave: (body: Record<string, string>) => void;
}) {
  const { t } = useLocale();
  const windows = [
    ['startsAt', 'Bắt đầu sự kiện', 'Event starts'],
    ['endsAt', 'Kết thúc sự kiện', 'Event ends'],
    ['saleOpensAt', 'Mở bán', 'Sales open'],
    ['saleClosesAt', 'Đóng bán', 'Sales close'],
    ['counterOpensAt', 'Mở quầy check-in', 'Counter opens'],
    ['counterClosesAt', 'Đóng quầy check-in', 'Counter closes'],
    ['admissionOpensAt', 'Mở cửa vào', 'Admission opens'],
    ['admissionClosesAt', 'Đóng cửa vào', 'Admission closes'],
  ] as const;
  return (
    <details>
      <summary>
        <Plus size={16} aria-hidden="true" />
        {t('Thêm suất diễn', 'Add session')}
      </summary>
      {graph.layouts.length ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget),
              body: Record<string, string> = { layoutId: String(fields.get('layoutId')) };
            for (const [key] of windows)
              body[key] = new Date(String(fields.get(key))).toISOString();
            onSave(body);
          }}
        >
          <fieldset className="workspace-form" disabled={locked}>
            <Select label={t('Sơ đồ', 'Layout')} name="layoutId" required>
              {graph.layouts
                .filter((layout) => layout.status === 'DRAFT')
                .map((layout) => (
                  <option key={layout.id} value={layout.id}>
                    #{layout.id} ·{' '}
                    {options.venues.find((venue) => venue.id === layout.venue_id)?.name}
                  </option>
                ))}
            </Select>
            <p className="workspace-note">
              {t('Nhập theo múi giờ trình duyệt của bạn', 'Enter times in your browser timezone')}:{' '}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}.{' '}
              {t(
                'Thời điểm được lưu UTC và hiển thị theo múi giờ địa điểm.',
                'Instants are stored in UTC and displayed in the venue timezone.',
              )}
            </p>
            <div className="workspace-form-grid">
              {windows.map(([key, vi, en]) => (
                <label key={key}>
                  {t(vi, en)}
                  <input name={key} type="datetime-local" required />
                </label>
              ))}
            </div>
            <div>
              <Button variant="primary" type="submit" className="workspace-primary">
                {t('Lưu suất diễn', 'Save session')}
              </Button>
            </div>
          </fieldset>
        </form>
      ) : (
        <WorkspaceEmpty
          title={t('Lưu sơ đồ trước khi thêm suất diễn', 'Save a layout before adding a session')}
        />
      )}
    </details>
  );
}

function TicketPricing({
  graph,
  locked,
  onType,
  onPrice,
}: {
  graph: EventGraph;
  locked: boolean;
  onType: (sessionId: string, body: { code: string; name: string }) => void;
  onPrice: (
    sessionId: string,
    prices: (
      | { seatId: string; ticketTypeId: string; priceMinor: string; currency: 'VND' }
      | { sectionId: string; ticketTypeId: string; priceMinor: string; currency: 'VND' }
    )[],
  ) => void;
}) {
  const { t } = useLocale();
  const date = useWorkspaceDate();
  const [sessionId, setSessionId] = useState(graph.sessions[0]?.id ?? '');
  const session = graph.sessions.find((value) => value.id === sessionId);
  const types = graph.ticketTypes.filter((type) => type.session_id === sessionId);
  const zones = graph.zones.filter((zone) => zone.layout_id === session?.layout_id);
  return (
    <div className="workspace-form">
      <Select
        label={t('Suất diễn', 'Session')}
        value={sessionId}
        onChange={(event) => setSessionId(event.target.value)}
      >
        {graph.sessions.map((value) => (
          <option key={value.id} value={value.id}>
            #{value.id} · {date(value.starts_at, value.timezone)}
          </option>
        ))}
      </Select>
      {types.length > 0 && (
        <div className="workspace-actions">
          {types.map((type) => (
            <span className="workspace-status" key={type.id}>
              {type.code} · {type.name}
            </span>
          ))}
        </div>
      )}
      {!locked && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            onType(sessionId, {
              code: String(fields.get('code')).trim(),
              name: String(fields.get('name')).trim(),
            });
          }}
        >
          <fieldset className="workspace-form" disabled={locked}>
            <div className="workspace-form-grid">
              <Input
                label={t('Mã loại vé mới', 'New ticket type code')}
                name="code"
                maxLength={48}
                required
              />
              <Input
                label={t('Tên loại vé', 'Ticket type name')}
                name="name"
                maxLength={120}
                required
              />
            </div>
            <div>
              <Button variant="outline" type="submit">
                <Plus size={16} aria-hidden="true" />
                {t('Thêm loại vé', 'Add ticket type')}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {types.length > 0 && !locked && (
        <form
          key={sessionId}
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const currency = 'VND' as const;
            if (graph.event.ticketing_mode === 'QUANTITY')
              onPrice(
                sessionId,
                zones.map((zone) => ({
                  sectionId: zone.id,
                  ticketTypeId: String(fields.get(`type:${zone.id}`)),
                  priceMinor: String(fields.get(`price:${zone.id}`)),
                  currency,
                })),
              );
            else
              onPrice(
                sessionId,
                graph.seats
                  .filter((seat) => seat.layout_id === session?.layout_id)
                  .map((seat) => ({
                    seatId: seat.id,
                    ticketTypeId: String(fields.get('type')),
                    priceMinor: String(fields.get('price')),
                    currency,
                  })),
              );
          }}
        >
          <fieldset className="workspace-form" disabled={locked}>
            {graph.event.ticketing_mode === 'QUANTITY' ? (
              zones.map((zone) => (
                <div className="workspace-form-grid" key={zone.id}>
                  <label>
                    {zone.name} · {t('Loại vé', 'Ticket type')}
                    <select name={`type:${zone.id}`} required>
                      {types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Input
                    label={t('Giá VND mỗi vé', 'Price per ticket in VND')}
                    name={`price:${zone.id}`}
                    inputMode="numeric"
                    pattern="[1-9][0-9]{0,15}"
                    required
                  />
                </div>
              ))
            ) : (
              <>
                <p className="workspace-note">
                  {t(
                    'Cấu hình cơ bản áp dụng cùng một loại vé và giá cho toàn bộ ghế trong sơ đồ của suất này.',
                    'Basic pricing applies one ticket type and price to every seat in this session layout.',
                  )}
                </p>
                <div className="workspace-form-grid">
                  <Select label={t('Loại vé', 'Ticket type')} name="type" required>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label={t('Giá VND mỗi ghế', 'Price per seat in VND')}
                    name="price"
                    inputMode="numeric"
                    pattern="[1-9][0-9]{0,15}"
                    required
                  />
                </div>
              </>
            )}
            <div>
              <Button variant="primary" type="submit" className="workspace-primary">
                {t('Lưu bảng giá suất diễn', 'Save session pricing')}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
    </div>
  );
}

function SavedLayoutPreview({ graph, layoutId }: { graph: EventGraph; layoutId: string }) {
  const { t } = useLocale();
  const layout = graph.layouts.find((value) => value.id === layoutId);
  if (!layout) return null;
  const width = Number(layout.canvas_width),
    height = Number(layout.canvas_height);
  const geometry = z
    .object({
      stage: z
        .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
        .nullable()
        .optional(),
    })
    .safeParse(layout.geometry_json);
  const stage = geometry.success ? geometry.data.stage : undefined;
  return (
    <div className="workspace-layout-preview">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('Sơ đồ đã lưu', 'Saved layout')}
      >
        {stage && <rect {...stage} rx={Math.min(width, height) * 0.01} />}
        {graph.seats
          .filter((seat) => seat.layout_id === layoutId)
          .map((seat) => (
            <rect
              key={seat.id}
              x={Number(seat.map_x)}
              y={Number(seat.map_y)}
              width={Number(seat.width)}
              height={Number(seat.height)}
              rx={Math.min(Number(seat.width), Number(seat.height)) * 0.2}
            />
          ))}
        {graph.zones
          .filter((zone) => zone.layout_id === layoutId)
          .map((zone) => {
            const rect = z
              .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
              .safeParse(zone.geometry_json);
            return rect.success ? (
              <g key={zone.id}>
                <rect {...rect.data} rx={Math.min(width, height) * 0.015} />
                <text
                  x={rect.data.x + rect.data.width / 2}
                  y={rect.data.y + rect.data.height / 2}
                  textAnchor="middle"
                  fontSize={Math.min(height * 0.04, rect.data.height / 4)}
                >
                  {zone.code} · {zone.capacity}
                </text>
              </g>
            ) : null;
          })}
      </svg>
    </div>
  );
}
