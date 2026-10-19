import type { PoolClient } from 'pg';
import { withTransaction } from '../../shared/database/transaction.js';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { claimKey, finishKey } from '../../shared/idempotency/idempotency.repository.js';
import { requireBuyer } from '../bookings/shared/booking.repository.js';
import { MerchandiseRepository, type Order } from './merchandise.repository.js';
import { MerchandisePaymentAdapter } from './merchandise-payment.adapter.js';
import { encryptRecipient, decryptRecipient } from './recipient.crypto.js';
import type { ProductInput, OrderInput, FulfillmentInput } from './merchandise.schema.js';
const missing = () => new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.');
const conflict = (message: string) => new AppError(409, 'MERCHANDISE_CONFLICT', message);
export class MerchandiseService {
  constructor(
    private readonly repository = new MerchandiseRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  private async productDto(db: PoolClient, id: string) {
    const p = await this.repository.product(db, id);
    if (!p) throw missing();
    return { ...p, skus: await this.repository.productSkus(db, id) };
  }
  async createProduct(
    actor: RequestActor,
    eventId: string,
    input: ProductInput,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const r = this.repository,
        e = await r.event(db, eventId);
      if (!e) throw missing();
      await this.access.organizer(db, actor, e.organization_id, 'event.update_own', true);
      const c = await claimKey(db, actor.id, 'merchandise.create', key, { eventId, input });
      const currentEvent = await r.event(db, eventId, true);
      if (c.resource_id) return this.productDto(db, c.resource_id);
      if (!currentEvent || !['DRAFT', 'PUBLISHED'].includes(currentEvent.status))
        throw conflict('Sự kiện không cho tạo sản phẩm.');
      const id = await r.createProduct(db, eventId, e.organization_id, input);
      await r.saveSkus(db, id, input);
      await r.audit(
        db,
        actor.id,
        id,
        'merchandise.create',
        e.organization_id,
        requestId,
        'MERCHANDISE',
      );
      await finishKey(db, c.id, 'MERCHANDISE', id, 201);
      return this.productDto(db, id);
    });
  }
  async product(actor: RequestActor, id: string, admin = false) {
    return withTransaction(async (db) => {
      const p = await this.repository.product(db, id);
      if (!p) throw missing();
      if (admin) await this.access.admin(db, actor, 'event.review');
      else await this.access.organizer(db, actor, p.organization_id, 'event.update_own', true);
      return this.productDto(db, id);
    });
  }
  async products(
    actor: RequestActor,
    eventId: string | undefined,
    status: string | undefined,
    page: number,
    size: number,
  ) {
    return withTransaction(async (db) => {
      let orgId: string | null = null;
      if (eventId) {
        const e = await this.repository.event(db, eventId);
        if (!e) throw missing();
        orgId = e.organization_id;
        await this.access.organizer(db, actor, orgId, 'event.update_own', true);
      } else await this.access.admin(db, actor, 'event.review');
      return this.repository.listProducts(db, eventId ?? null, orgId, status, page, size);
    });
  }
  async changeProduct(
    actor: RequestActor,
    id: string,
    action: 'edit' | 'submit' | 'archive' | 'approve' | 'reject',
    version: number,
    reason: string,
    input: ProductInput | undefined,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const r = this.repository,
        first = await r.product(db, id);
      if (!first) throw missing();
      if (action === 'approve' || action === 'reject')
        await this.access.admin(db, actor, 'event.review');
      else await this.access.organizer(db, actor, first.organization_id, 'event.update_own', true);
      const claim = await claimKey(db, actor.id, 'merchandise.' + action, key, {
        id,
        version,
        reason,
        input,
      });
      const e = await r.event(db, first.event_id, true),
        p = (await r.product(db, id, true))!;
      if (claim.resource_id) return this.productDto(db, id);
      if (p.version !== version) throw conflict('Version sản phẩm đã đổi.');
      if (action === 'edit') {
        if (!['DRAFT', 'REJECTED'].includes(p.status) || !input)
          throw conflict('Chỉ sửa bản nháp hoặc bị từ chối.');
        await r.updateProduct(db, id, input);
        await r.saveSkus(db, id, input);
      } else {
        if (action === 'submit') {
          if (
            !['DRAFT', 'REJECTED'].includes(p.status) ||
            !p.image_url ||
            (await r.productSkus(db, id)).filter((s) => s.active).length === 0
          )
            throw conflict('Cần ảnh R2 và SKU trước khi gửi duyệt.');
        } else if (action === 'approve' || action === 'reject') {
          if (
            p.status !== 'PENDING_REVIEW' ||
            (action === 'approve' && e?.organization_status !== 'APPROVED')
          )
            throw conflict('Cần sản phẩm chờ duyệt và tổ chức đã duyệt.');
        } else if (p.status === 'ARCHIVED') throw conflict('Sản phẩm đã lưu trữ.');
        await r.transition(
          db,
          id,
          action === 'submit'
            ? 'PENDING_REVIEW'
            : action === 'approve'
              ? 'PUBLISHED'
              : action === 'reject'
                ? 'REJECTED'
                : 'ARCHIVED',
          actor.id,
          reason,
        );
      }
      await r.audit(
        db,
        actor.id,
        id,
        'merchandise.' + action,
        p.organization_id,
        requestId,
        'MERCHANDISE',
      );
      await finishKey(db, claim.id, 'MERCHANDISE', id, 200);
      return this.productDto(db, id);
    });
  }
  async stock(
    actor: RequestActor,
    id: string,
    version: number,
    total: number,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const r = this.repository,
        first = (await r.skus(db, [id]))[0];
      if (!first) throw missing();
      const p = (await r.product(db, first.product_id))!;
      await this.access.organizer(db, actor, p.organization_id, 'event.update_own', true);
      const claim = await claimKey(db, actor.id, 'merchandise.stock', key, { id, version, total });
      await r.event(db, p.event_id, true);
      await r.product(db, p.id, true);
      const s = (await r.skus(db, [id], true))[0]!;
      if (claim.resource_id) return s;
      if (s.version !== version || total < s.stock_total)
        throw conflict('Chỉ bổ sung tồn kho đúng version; không hạ dưới cam kết.');
      await r.updateStock(db, id, total);
      await r.audit(
        db,
        actor.id,
        p.id,
        'merchandise.stock',
        p.organization_id,
        requestId,
        'MERCHANDISE',
      );
      await finishKey(db, claim.id, 'MERCHANDISE', p.id, 200);
      return (await r.skus(db, [id]))[0]!;
    });
  }
  async publicSkus(publicId: string) {
    return withTransaction(async (db) => {
      const p = await this.repository.publicProduct(db, publicId);
      if (!p) throw missing();
      const r = this.repository;
      return {
        eventId: p.event_id,
        productId: p.id,
        shippingFeeMinor: (await r.product(db, p.id))!.shipping_fee_minor,
        skus: await Promise.all(
          (await r.productSkus(db, p.id))
            .filter((s) => s.active)
            .map(async (s) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              priceMinor: s.price_minor,
              currency: 'VND',
              available: Math.max(
                0,
                s.stock_total - s.sold_quantity - (await r.reserved(db, s.id)),
              ),
            })),
        ),
      };
    });
  }
  async createOrder(actor: RequestActor, input: OrderInput, key: string, requestId: string) {
    return withTransaction(async (db) => {
      const r = this.repository;
      await requireBuyer(db, actor, 'booking.create');
      const claim = await claimKey(db, actor.id, 'merchandise.order.create', key, input);
      if (claim.resource_id) {
        const o = await r.order(db, claim.resource_id);
        if (!o || o.customer_id !== actor.id) throw missing();
        return this.orderDto(db, o, true);
      }
      const e = await r.event(db, input.eventId, true);
      if (e?.status !== 'PUBLISHED' || e.organization_status !== 'APPROVED' || !e.public_now)
        throw conflict('Sự kiện không nhận đơn mới.');
      const ids = input.items.map((i) => i.skuId);
      await r.lockProducts(db, ids);
      const skus = await r.skus(db, ids, true);
      if (
        skus.length !== ids.length ||
        skus.some(
          (s) => s.event_id !== input.eventId || !s.active || s.product_status !== 'PUBLISHED',
        )
      )
        throw conflict('SKU không được mở bán tại sự kiện này.');
      if (skus.some((s) => s.requires_ticket) && !(await r.ticket(db, actor.id, input.eventId)))
        throw conflict('Sản phẩm yêu cầu vé VALID/USED của chính người mua.');
      let subtotal = 0n,
        shipping = 0n;
      for (const s of skus) {
        const q = input.items.find((i) => i.skuId === s.id)!.quantity;
        if (s.stock_total - s.sold_quantity - (await r.reserved(db, s.id)) < q)
          throw conflict('Tồn kho không đủ.');
        subtotal += BigInt(s.price_minor) * BigInt(q);
        if (BigInt(s.shipping_fee_minor) > shipping) shipping = BigInt(s.shipping_fee_minor);
      }
      const total = subtotal + shipping;
      if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw conflict('Tổng tiền vượt giới hạn payOS.');
      const id = await r.nextOrderId(db);
      await r.insertOrder(
        db,
        id,
        actor.id,
        input.eventId,
        e.organization_id,
        total.toString(),
        shipping.toString(),
        encryptRecipient(input.recipient, id),
      );
      for (const s of skus)
        await r.insertItem(db, id, s, input.items.find((i) => i.skuId === s.id)!.quantity);
      await r.audit(db, actor.id, id, 'merchandise.order.create', e.organization_id, requestId);
      await finishKey(db, claim.id, 'MERCHANDISE_ORDER', id, 201);
      return this.orderDto(db, (await r.order(db, id))!, true);
    });
  }
  async orderDto(db: PoolClient, o: Order, recipient: boolean) {
    return {
      id: o.id,
      eventId: o.event_id,
      organizationId: o.organization_id,
      status: o.status,
      fulfillmentStatus: o.fulfillment_status,
      totalMinor: o.total_minor,
      shippingFeeMinor: o.shipping_fee_minor,
      currency: o.currency,
      expiresAt: o.expires_at.toISOString(),
      version: o.version,
      trackingReference: o.tracking_reference,
      fulfillmentNote: o.fulfillment_note,
      shippedAt: o.shipped_at,
      deliveredAt: o.delivered_at,
      items: await this.repository.items(db, o.id),
      payments: await this.repository.orderPayments(db, o.id),
      ...(recipient ? { recipient: decryptRecipient(o.recipient_ciphertext, o.id) } : {}),
    };
  }
  async authorizeOrder(
    db: PoolClient,
    actor: RequestActor,
    o: Order,
    scope: 'self' | 'organizer' | 'admin',
    reportId?: string,
  ) {
    if (scope === 'self') {
      await requireBuyer(db, actor, 'booking.read_self');
      if (o.customer_id !== actor.id) throw missing();
    } else if (scope === 'organizer')
      await this.access.organizer(db, actor, o.organization_id, 'sales.read_own');
    else {
      await this.access.admin(db, actor, 'report.handle');
      if (!reportId || !(await this.repository.report(db, reportId, actor.id, o))) throw missing();
    }
  }
  async order(
    actor: RequestActor,
    id: string,
    scope: 'self' | 'organizer' | 'admin',
    reportId?: string,
    requestId?: string,
  ) {
    return withTransaction(async (db) => {
      const o = await this.repository.order(db, id);
      if (!o) throw missing();
      await this.authorizeOrder(db, actor, o, scope, reportId);
      if (scope === 'admin')
        await this.repository.audit(
          db,
          actor.id,
          id,
          'merchandise.order.support',
          o.organization_id,
          requestId!,
          'MERCHANDISE_ORDER',
          reportId,
        );
      return this.orderDto(
        db,
        o,
        scope !== 'admin' && (scope === 'self' || o.status === 'CONFIRMED'),
      );
    });
  }
  async orders(actor: RequestActor, orgId: string | undefined, page: number, size: number) {
    return withTransaction(async (db) => {
      if (orgId) await this.access.organizer(db, actor, orgId, 'sales.read_own');
      else await requireBuyer(db, actor, 'booking.read_self');
      return this.repository.listOrders(
        db,
        orgId ? 'organization_id' : 'customer_id',
        orgId ?? actor.id,
        page,
        size,
      );
    });
  }
  async cancel(actor: RequestActor, id: string, version: number, key: string, requestId: string) {
    return withTransaction(async (db) => {
      const r = this.repository;
      await requireBuyer(db, actor, 'booking.create');
      const claim = await claimKey(db, actor.id, 'merchandise.order.cancel', key, { id, version });
      const p = await new MerchandisePaymentAdapter(r).lock(db, id, actor.id),
        o = (await r.order(db, id))!;
      if (claim.resource_id) return this.orderDto(db, o, true);
      if (o.version !== version || p.status !== 'AWAITING_PAYMENT')
        throw conflict('Đơn không còn chờ thanh toán hoặc đã đổi version.');
      await r.cancel(db, id, p.expired ? 'EXPIRED' : 'CANCELLED');
      await r.audit(db, actor.id, id, 'merchandise.order.cancel', o.organization_id, requestId);
      await finishKey(db, claim.id, 'MERCHANDISE_ORDER', id, 200);
      return this.orderDto(db, (await r.order(db, id))!, true);
    });
  }
  async fulfill(
    actor: RequestActor,
    id: string,
    input: FulfillmentInput,
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      const r = this.repository,
        first = await r.order(db, id);
      if (!first) throw missing();
      await this.access.organizer(db, actor, first.organization_id, 'sales.read_own');
      await this.access.permission(db, actor, 'event.update_own');
      const claim = await claimKey(db, actor.id, 'merchandise.fulfill', key, { id, input });
      const e = await r.event(db, first.event_id, true);
      const o = (await r.order(db, id, true))!;
      if (claim.resource_id) return this.orderDto(db, o, true);
      const refund = await r.hasRefund(db, id);
      if (
        o.status !== 'CONFIRMED' ||
        o.version !== input.version ||
        (input.status === 'SHIPPED' && e?.status !== 'PUBLISHED') ||
        refund ||
        !(
          (o.fulfillment_status === 'UNFULFILLED' && input.status === 'SHIPPED') ||
          (o.fulfillment_status === 'SHIPPED' &&
            ['DELIVERED', 'DELIVERY_FAILED'].includes(input.status)) ||
          (o.fulfillment_status === 'DELIVERY_FAILED' && input.status === 'SHIPPED')
        )
      )
        throw conflict('Trạng thái giao hàng/version hoặc yêu cầu hoàn tiền không cho phép.');
      await r.fulfill(db, id, input.status, input.reference, input.note);
      await r.audit(db, actor.id, id, 'merchandise.fulfill', o.organization_id, requestId);
      await finishKey(db, claim.id, 'MERCHANDISE_ORDER', id, 200);
      return this.orderDto(db, (await r.order(db, id))!, true);
    });
  }
  async expire() {
    return withTransaction(async (db) => {
      const r = this.repository,
        rows = await r.expireCandidates(db);
      for (const row of rows) {
        const o = await r.order(db, row.id, true);
        if (o?.status === 'AWAITING_PAYMENT' && o.expires_at <= (await r.now(db)))
          await r.cancel(db, row.id, 'EXPIRED');
      }
      return rows.length === 100;
    });
  }
  async overview(actor: RequestActor, orgId: string, from?: string, to?: string) {
    return withTransaction(async (db) => {
      await this.access.organizer(db, actor, orgId, 'sales.read_own');
      return {
        basis: 'MERCHANDISE_ORDER_CREATED_COHORT',
        range: { from: from ?? null, to: to ?? null },
        ...(await this.repository.overview(db, orgId, from, to)),
      };
    });
  }
}
