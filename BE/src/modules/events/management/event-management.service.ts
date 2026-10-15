import type { PoolClient } from 'pg';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { EventManagementRepository } from './event-management.repository.js';
import { validateLayout, validateZoneLayout } from './layout.policy.js';
import type {
  DraftInput,
  ZoneLayoutInput,
  ZonePricingInput,
  LayoutInput,
  SessionInput,
  PricingInput,
  ReviewHistoryQuery,
} from './event-management.schema.js';
export class EventManagementService {
  async remove(actor: RequestActor, id: string, version: number, requestId: string) {
    await withTransaction(async (db) => {
      const event = await this.scoped(db, actor, id);
      this.draft(event, version);
      await this.repository.removeDraft(db, id);
      await this.repository.audit(db, actor.id, id, 'event.delete_draft', requestId);
    });
  }
  async reasonQueue(actor: RequestActor, page: number, pageSize: number) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.review');
      return this.repository.reasonQueue(db, pageSize, (page - 1) * pageSize);
    });
  }
  async reasonPreview(actor: RequestActor, id: string) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.review');
      const row = await this.repository.reasonDetail(db, id);
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
      return {
        ...row,
        preview: row.notice
          ? `Hồ sơ ${row.reviewId} của ${row.organizationName} cho sự kiện ${row.eventTitle}. Lý do: ${row.notice.reason ?? ''}. Hướng dẫn: ${row.notice.guidance ?? ''}.`
          : null,
      };
    });
  }
  async saveReasonDraft(
    actor: RequestActor,
    id: string,
    input: { version: number; reasonCode: string; reason: string; guidance: string },
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.review');
      const record = await claimKey(db, actor.id, 'event.review.reason_draft', key, { id, input });
      const locator = await this.repository.reviewLocator(db, id);
      if (!locator) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
      await this.repository.event(db, locator.event_id, true);
      const review = await this.repository.review(db, id);
      if (record.resource_id) return this.repository.reasonDetail(db, id);
      if (!review || !['PENDING', 'EXPIRED'].includes(review.status))
        throw new AppError(409, 'NOTICE_STATE_CONFLICT', 'Hồ sơ không cho phép soạn phiếu.');
      const notice = await this.repository.saveReasonDraft(db, id, actor.id, input);
      await this.repository.audit(
        db,
        actor.id,
        locator.event_id,
        'event.review.reason_draft',
        requestId,
      );
      await finishKey(db, record.id, 'REASON_NOTICE', notice.id, 200);
      return this.repository.reasonDetail(db, id);
    });
  }
  async history(actor: RequestActor, q: ReviewHistoryQuery, eventId?: string) {
    return withTransaction(async (db) => {
      let filters = q;
      if (eventId) {
        const event = await this.scoped(db, actor, eventId);
        filters = { ...q, eventId, organizationId: event.organization_id };
      } else await this.access.permission(db, actor, 'event.review');
      const result = await this.repository.history(db, filters);
      return {
        ...result,
        pagination: {
          page: q.page,
          pageSize: q.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / q.pageSize),
        },
      };
    });
  }
  async ownReview(actor: RequestActor, id: string) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.update_own');
      const review = await this.repository.reviewDetail(db, id);
      if (!review) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
      await this.scoped(db, actor, review.event_id);
      return review;
    });
  }
  async options(actor: RequestActor) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.create');
      return this.repository.options(db);
    });
  }
  async review(actor: RequestActor, id: string) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.review');
      const review = await this.repository.reviewDetail(db, id);
      if (!review) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
      return review;
    });
  }
  async sendReason(
    actor: RequestActor,
    id: string,
    input: { version: number; reason: string; guidance: string; reasonCode?: string | undefined },
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.review');
      const record = await claimKey(db, actor.id, 'event.review.reason', key, { id, input });
      if (record.resource_id) return { id: record.resource_id, status: 'SENT' };
      const locator = await this.repository.reviewLocator(db, id);
      if (!locator) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
      await this.repository.event(db, locator.event_id, true);
      const review = await this.repository.review(db, id);
      if (!review || review.status !== 'EXPIRED')
        throw new AppError(409, 'REVIEW_NOT_EXPIRED', 'Hồ sơ chưa hết hạn.');
      const noticeId = await this.repository.sendReason(db, id, actor.id, input);
      await this.repository.audit(db, actor.id, review.event_id, 'event.review.reason', requestId);
      await finishKey(db, record.id, 'REASON_NOTICE', noticeId, 200);
      return { id: noticeId, status: 'SENT' };
    });
  }
  constructor(
    private readonly repository = new EventManagementRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  private async scoped(
    db: PoolClient,
    actor: RequestActor,
    id: string,
    permission = 'event.update_own',
  ) {
    const event = await this.repository.event(db, id);
    if (!event) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
    await this.access.organizer(db, actor, event.organization_id, permission, true);
    return (await this.repository.event(db, id, true))!;
  }
  private draft(event: { status: string; version: number }, version: number) {
    if (event.status !== 'DRAFT' || event.version !== version)
      throw new AppError(409, 'EVENT_VERSION_CONFLICT', 'Sự kiện phải ở bản nháp đúng version.');
  }
  async list(actor: RequestActor) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.update_own');
      return this.repository.list(db, actor.id);
    });
  }
  async get(actor: RequestActor, id: string) {
    return withTransaction(async (db) => {
      await this.scoped(db, actor, id);
      return this.repository.graph(db, id);
    });
  }
  async create(actor: RequestActor, input: DraftInput, key: string, requestId: string) {
    return withTransaction(async (db) => {
      await this.access.organizer(db, actor, input.organizationId, 'event.create', true);
      const record = await claimKey(db, actor.id, 'event.create', key, input);
      if (record.resource_id) return this.repository.graph(db, record.resource_id);
      const id = await this.repository.create(db, actor.id, input);
      await this.repository.audit(db, actor.id, id, 'event.create', requestId);
      await finishKey(db, record.id, 'EVENT', id, 201);
      return this.repository.graph(db, id);
    });
  }
  async configure(
    actor: RequestActor,
    id: string,
    kind:
      | 'edit'
      | 'layout'
      | 'session'
      | 'session-edit'
      | 'type'
      | 'prices'
      | 'reopen'
      | 'zone-layout'
      | 'zone-prices',
    input: unknown,
    version: number,
    key: string,
    requestId: string,
    sessionId?: string,
  ) {
    return withTransaction(async (db) => {
      const permission =
        kind === 'layout' || kind === 'zone-layout'
          ? 'layout.manage_own'
          : kind === 'type' || kind === 'prices' || kind === 'zone-prices'
            ? 'ticket_type.manage_own'
            : 'event.update_own';
      const event = await this.scoped(db, actor, id, permission);
      const record = await claimKey(db, actor.id, 'event.configure.' + kind, key, {
        id,
        sessionId: sessionId ?? null,
        input,
      });
      if (record.resource_id) return this.repository.graph(db, id);
      if (kind === 'reopen') {
        if (event.status !== 'REJECTED' || event.version !== version)
          throw new AppError(
            409,
            'EVENT_VERSION_CONFLICT',
            'Chỉ mở lại bản bị từ chối đúng version.',
          );
        await this.repository.reopen(db, id);
      } else {
        this.draft(event, version);
        if (kind === 'edit')
          await this.repository.update(
            db,
            id,
            input as Omit<DraftInput, 'organizationId' | 'ticketingMode'>,
          );
        if (kind === 'layout' || kind === 'zone-layout') {
          if (event.ticketing_mode !== (kind === 'zone-layout' ? 'QUANTITY' : 'NUMBERED'))
            throw new AppError(
              422,
              'TICKETING_MODE_CONFLICT',
              'Sơ đồ không đúng hình thức vé của sự kiện.',
            );
          const data = input as LayoutInput,
            venue = await this.repository.venue(db, data.venueId);
          if (
            venue.bounds_json.type !== 'rectangle' ||
            Number(venue.bounds_json.x) !== 0 ||
            Number(venue.bounds_json.y) !== 0 ||
            Number(venue.bounds_json.width) !== Number(venue.canvas_width) ||
            Number(venue.bounds_json.height) !== Number(venue.canvas_height)
          )
            throw new AppError(
              422,
              'UNSUPPORTED_VENUE_BOUNDS',
              'Địa điểm cần khung chữ nhật đã cấu hình.',
            );
          if (kind === 'zone-layout') {
            const zoneData = input as ZoneLayoutInput;
            validateZoneLayout(
              zoneData,
              Number(venue.canvas_width),
              Number(venue.canvas_height),
              venue.max_capacity,
            );
            await this.repository.zoneLayout(db, event, zoneData, venue);
          } else {
            validateLayout(
              data,
              Number(venue.canvas_width),
              Number(venue.canvas_height),
              venue.max_capacity,
            );
            await this.repository.layout(db, event, data, venue);
          }
        }
        if (kind === 'session' || kind === 'session-edit') {
          const data = input as SessionInput;
          const d = (value: string) => new Date(value).getTime();
          if (
            d(data.endsAt) <= d(data.startsAt) ||
            d(data.saleClosesAt) <= d(data.saleOpensAt) ||
            d(data.counterClosesAt) <= d(data.counterOpensAt) ||
            d(data.admissionClosesAt) <= d(data.admissionOpensAt) ||
            d(data.counterClosesAt) > d(data.admissionClosesAt) ||
            d(data.admissionClosesAt) > d(data.endsAt)
          )
            throw new AppError(422, 'INVALID_SESSION_WINDOWS', 'Các khoảng giờ không hợp lệ.');
          await this.repository.createSession(
            db,
            id,
            data,
            kind === 'session-edit' ? sessionId : undefined,
          );
        }
        if (kind === 'type' || kind === 'prices' || kind === 'zone-prices') {
          if (
            kind !== 'type' &&
            event.ticketing_mode !== (kind === 'zone-prices' ? 'QUANTITY' : 'NUMBERED')
          )
            throw new AppError(422, 'TICKETING_MODE_CONFLICT', 'Giá không đúng hình thức vé.');
          const session = await this.repository.session(db, sessionId!, id);
          if (kind === 'type')
            await this.repository.type(db, session.id, input as { code: string; name: string });
          else if (kind === 'zone-prices')
            await this.repository.zonePrices(db, session, (input as ZonePricingInput).prices);
          else await this.repository.prices(db, session, (input as PricingInput).prices);
        }
        await this.repository.bump(db, id);
      }
      await this.repository.audit(db, actor.id, id, 'event.configure.' + kind, requestId);
      await finishKey(db, record.id, 'EVENT', id, 200);
      return this.repository.graph(db, id);
    });
  }
  async submit(actor: RequestActor, id: string, version: number, key: string, requestId: string) {
    return withTransaction(async (db) => {
      const event = await this.scoped(db, actor, id, 'event.submit_own'),
        record = await claimKey(db, actor.id, 'event.submit', key, { id, version });
      if (record.resource_id) return this.repository.graph(db, id);
      this.draft(event, version);
      if (!event.cover_image_url)
        throw new AppError(422, 'EVENT_IMAGE_REQUIRED', 'Cần hoàn tất upload ảnh sự kiện R2.');
      const sessions = await this.repository.sessions(db, id);
      if (!sessions.length) throw new AppError(422, 'NO_SESSION', 'Cần ít nhất một suất.');
      for (const session of sessions) {
        if (!session.pricing_config)
          throw new AppError(422, 'INCOMPLETE_PRICING', 'Cần cấu hình giá mọi suất.');
        if (event.ticketing_mode === 'QUANTITY')
          await this.repository.zonePrices(
            db,
            session,
            session.pricing_config as ZonePricingInput['prices'],
          );
        else
          await this.repository.prices(
            db,
            session,
            session.pricing_config as PricingInput['prices'],
          );
      }
      const graph = await this.repository.graph(db, id);
      await this.repository.submit(db, event, actor.id, graph);
      await this.repository.audit(db, actor.id, id, 'event.submit', requestId);
      await finishKey(db, record.id, 'EVENT', id, 200);
      return this.repository.graph(db, id);
    });
  }
  async pending(actor: RequestActor) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'event.review');
      return this.repository.pending(db);
    });
  }
  async decide(
    actor: RequestActor,
    reviewId: string,
    action: 'APPROVED' | 'REJECTED' | 'WITHDRAWN',
    input: { version: number; reason?: string; guidance?: string; reasonCode?: string | undefined },
    key: string,
    requestId: string,
  ) {
    const result = await withTransaction(async (db) => {
      await this.access.permission(
        db,
        actor,
        action === 'WITHDRAWN' ? 'event.submit_own' : 'event.review',
      );
      const locator = await this.repository.reviewLocator(db, reviewId);
      if (!locator) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
      const found = await this.repository.event(db, locator.event_id);
      if (!found) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
      const org = await this.repository.organization(db, found.organization_id);
      const event =
        action === 'WITHDRAWN'
          ? await this.scoped(db, actor, found.id, 'event.submit_own')
          : (await this.repository.event(db, found.id, true))!;
      const review = await this.repository.review(db, reviewId);
      if (!review) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy hồ sơ.');
      const record = await claimKey(db, actor.id, 'event.review.decide', key, {
        reviewId,
        action,
        input,
      });
      if (record.resource_id) return { data: await this.repository.graph(db, event.id) };
      if (
        review.status !== 'PENDING' ||
        event.status !== 'PENDING_REVIEW' ||
        review.event_version !== input.version ||
        event.version !== input.version
      )
        throw new AppError(409, 'REVIEW_VERSION_CONFLICT', 'Hồ sơ/version không còn chờ duyệt.');
      if (review.expired) {
        await this.repository.decide(db, event, review, null, 'EXPIRED', '', '');
        return { expired: true };
      }
      if (action === 'APPROVED' && org?.status !== 'APPROVED')
        throw new AppError(
          422,
          'ORGANIZATION_NOT_APPROVED',
          'Admin cần duyệt tổ chức trước khi mở bán.',
        );
      await this.repository.decide(
        db,
        event,
        review,
        actor.id,
        action,
        input.reason ?? '',
        input.guidance ?? '',
        input.reasonCode,
      );
      await this.repository.audit(
        db,
        actor.id,
        event.id,
        'event.review.' + action.toLowerCase(),
        requestId,
      );
      await finishKey(db, record.id, 'EVENT', event.id, 200);
      return { data: await this.repository.graph(db, event.id) };
    });
    if (result.expired) throw new AppError(409, 'REVIEW_EXPIRED', 'Hồ sơ đã hết hạn duyệt.');
    return result.data;
  }
  async expire() {
    return withTransaction(async (db) => {
      const candidates = await this.repository.expired(db);
      let count = 0;
      for (const candidate of candidates) {
        const event = await this.repository.event(db, candidate.event_id, true),
          review = await this.repository.review(db, candidate.id);
        if (event && review?.status === 'PENDING' && review.expired) {
          await this.repository.decide(db, event, review, null, 'EXPIRED', '', '');
          count++;
        }
      }
      return count === 100;
    });
  }
}
