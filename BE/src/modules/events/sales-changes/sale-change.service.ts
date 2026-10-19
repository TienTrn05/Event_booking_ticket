import type { PoolClient } from 'pg';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { validateLayout, validateZoneLayout } from '../management/layout.policy.js';
import { ReputationRepository } from '../../reputation/reputation.repository.js';
import { EventOperationsRepository } from '../operations/event-operations.repository.js';
import { SaleChangeRepository, type SaleContext } from './sale-change.repository.js';
import type { SaleChangeInput } from './sale-change.schema.js';
const conflict = (message: string) => new AppError(409, 'SALE_CHANGE_CONFLICT', message);
export class SaleChangeService {
  constructor(
    private readonly repository = new SaleChangeRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  private async validate(db: PoolClient, c: SaleContext, input: SaleChangeInput) {
    const now = await this.repository.now(db);
    if (c.event_status !== 'PUBLISHED' || c.session_status !== 'SCHEDULED' || c.starts_at <= now)
      throw conflict('Cần sự kiện công khai và suất chưa bắt đầu.');
    if (input.kind === 'NEW_SALE_WAVE') {
      if (
        c.sale_opens_at <= now &&
        now < c.sale_closes_at &&
        (new Date(input.saleOpensAt) > now || new Date(input.saleClosesAt) < c.sale_closes_at)
      )
        throw conflict(
          'Không thu hẹp cửa sổ đang bán hoặc làm mất hiệu lực hold cũ; chờ đợt cũ đóng hoặc gia hạn cửa sổ.',
        );
      if (
        new Date(input.saleOpensAt) >= new Date(input.saleClosesAt) ||
        new Date(input.saleClosesAt) > c.starts_at ||
        new Date(input.saleClosesAt) <= now
      )
        throw conflict('Cửa sổ bán phải còn hạn và không quá giờ bắt đầu.');
      return;
    }
    const types = new Set(await this.repository.types(db, c.session_id));
    if ([...input.seats, ...input.zones].some((p) => !types.has(p.ticketTypeId)))
      throw conflict('TicketType không thuộc suất.');
    const capacity = Math.min(c.max_capacity, c.capacity_snapshot, 100000),
      width = Number(c.canvas_width),
      height = Number(c.canvas_height);
    if (c.ticketing_mode === 'NUMBERED') {
      if (!input.seats.length || input.zones.length || input.increases.length)
        throw conflict('Indoor chỉ thêm ghế mới.');
      const old = await this.repository.seats(db, c.layout_id);
      const inventory = await this.repository.inventory(db, c.session_id),
        newSeats: typeof input.seats = [];
      const keys = new Set<string>();
      for (const seat of input.seats) {
        const key = JSON.stringify([seat.section, seat.row, seat.number]);
        if (keys.has(key)) throw conflict('Nhãn ghế trùng trong yêu cầu.');
        keys.add(key);
        const existing = old.find(
          (s) => s.section === seat.section && s.row === seat.row && s.number === seat.number,
        );
        if (existing) {
          if (
            inventory.some((i) => i.seat_id === existing.id) ||
            (['x', 'y', 'width', 'height'] as const).some((k) => seat[k] !== existing[k])
          )
            throw conflict('Không sửa hoặc tái bán ghế đã có trong suất.');
        } else newSeats.push(seat);
      }
      validateLayout(
        {
          version: c.event_version,
          venueId: c.venue_id,
          ...c.geometry_json,
          seats: [...old, ...newSeats],
        },
        width,
        height,
        capacity,
      );
    } else {
      if (
        input.seats.length ||
        (!input.zones.length && !input.increases.length) ||
        new Set(input.increases.map((z) => z.sectionId)).size !== input.increases.length
      )
        throw conflict('Outdoor cần khu mới hoặc tăng sức chứa khu.');
      const zones = await this.repository.zones(db, c.layout_id);
      const inventory = await this.repository.inventory(db, c.session_id);
      for (const increase of input.increases) {
        const zone = zones.find((z) => z.id === increase.sectionId);
        const allocated = inventory.filter((i) => i.section_id === increase.sectionId);
        if (
          !zone ||
          !allocated.length ||
          increase.capacity <= Math.max(...allocated.map((i) => i.inventory_number ?? 0))
        )
          throw conflict('Chỉ tăng sức chứa khu thuộc layout này.');
        zone.capacity = Math.max(zone.capacity, increase.capacity);
      }
      validateZoneLayout(
        {
          version: c.event_version,
          venueId: c.venue_id,
          ...c.geometry_json,
          zones: [...zones, ...input.zones],
        },
        width,
        height,
        capacity,
      );
    }
  }
  async request(
    actor: RequestActor,
    eventId: string,
    input: SaleChangeInput,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const first = await this.repository.context(db, eventId, input.sessionId);
      if (!first) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy suất.');
      await this.access.organizer(db, actor, first.organization_id, 'event.update_own');
      const claim = await claimKey(db, actor.id, 'event.sale.request', key, { eventId, input });
      if (claim.resource_id) return this.repository.request(db, claim.resource_id);
      const c = (await this.repository.context(db, eventId, input.sessionId, true))!;
      if (c.event_version !== input.version || (await this.repository.pending(db, eventId)))
        throw conflict('Version đã đổi hoặc đang có yêu cầu chờ duyệt.');
      await this.validate(db, c, input);
      const id = await this.repository.create(db, actor.id, c, input);
      await this.repository.audit(db, c, actor.id, id, 'event.sale.request', requestId);
      await finishKey(db, claim.id, 'EVENT_CHANGE', id, 201);
      return this.repository.request(db, id);
    });
  }
  async list(actor: RequestActor, eventId: string | undefined, page: number, size: number) {
    return withTransaction(async (db) => {
      let orgId: string | null = null;
      if (eventId) {
        const event = await new EventOperationsRepository().event(db, eventId);
        if (!event) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện.');
        orgId = event.organization_id;
        await this.access.organizer(db, actor, orgId, 'event.update_own');
      } else await this.access.admin(db, actor, 'event.review');
      return this.repository.list(db, eventId ?? null, orgId, page, size);
    });
  }
  async decide(
    actor: RequestActor,
    id: string,
    action: 'approve' | 'reject' | 'withdraw',
    version: number,
    reason: string,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const first = await this.repository.request(db, id);
      if (!first) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy yêu cầu.');
      if (action === 'withdraw')
        await this.access.organizer(db, actor, first.organization_id, 'event.update_own');
      else await this.access.admin(db, actor, 'event.review');
      const operations = new EventOperationsRepository();
      const approved = await operations.approvedOrganization(db, first.organization_id);
      const claim = await claimKey(db, actor.id, 'event.sale.' + action, key, {
        id,
        version,
        reason,
      });
      const c = await this.repository.context(
        db,
        first.event_id,
        first.snapshot_json.sessionId,
        true,
      );
      if (!c) throw conflict('Không còn suất hợp lệ.');
      const row = (await this.repository.request(db, id, true))!;
      if (claim.resource_id) return row;
      if (row.status !== 'PENDING' || row.version !== version)
        throw conflict('Trạng thái/version đã đổi.');
      if (action === 'approve') {
        if (!approved || c.event_version !== row.event_version)
          throw conflict('Tổ chức hoặc version sự kiện đã thay đổi.');
        await this.validate(db, c, row.snapshot_json);
        await this.repository.apply(db, c, row.snapshot_json);
        await operations.enqueue(
          db,
          (await operations.event(db, c.event_id))!,
          actor.id,
          'EVENT_UPDATED',
        );
      }
      await this.repository.decide(
        db,
        id,
        actor.id,
        action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : 'WITHDRAWN',
        reason,
        await new ReputationRepository().summary(db, c.organization_id),
      );
      await this.repository.audit(db, c, actor.id, id, 'event.sale.' + action, requestId);
      await finishKey(db, claim.id, 'EVENT_CHANGE', id, 200);
      return this.repository.request(db, id);
    });
  }
}
