import type { PoolClient } from 'pg';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import type {
  PaymentPurchase,
  PurchasePaymentPort,
} from '../payments/application/payment.ports.js';
import { requireBuyer } from '../bookings/shared/booking.repository.js';
import { AppError } from '../../shared/errors/app-error.js';
import { MerchandiseRepository } from './merchandise.repository.js';
export class MerchandisePaymentAdapter implements PurchasePaymentPort {
  constructor(private readonly repository = new MerchandiseRepository()) {}
  authorize(
    db: PoolClient,
    actor: RequestActor,
    permission: 'booking.create' | 'booking.read_self' = 'booking.create',
  ) {
    return requireBuyer(db, actor, permission);
  }
  async lock(db: PoolClient, id: string, ownerId?: string): Promise<PaymentPurchase> {
    const r = this.repository,
      first = await r.order(db, id);
    if (!first || (ownerId && first.customer_id !== ownerId))
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn hàng.');
    await r.lockUsers(db, [first.customer_id]);
    const event = await r.event(db, first.event_id, true),
      o = (await r.order(db, id, true))!,
      items = await r.items(db, id);
    await r.lockProducts(
      db,
      items.map((i) => i.sku_id),
    );
    const skus = await r.skus(
        db,
        items.map((i) => i.sku_id),
        true,
      ),
      now = await r.now(db);
    const active = await r.activeBuyer(db, o.customer_id);
    let stock = true;
    for (const i of items) {
      const s = skus.find((s) => s.id === i.sku_id);
      if (
        !s ||
        !s.active ||
        s.product_status !== 'PUBLISHED' ||
        s.stock_total - s.sold_quantity - (await r.reserved(db, s.id, id)) < i.quantity
      )
        stock = false;
    }
    return {
      id: o.id,
      customerId: o.customer_id,
      status: o.status,
      confirmedPaymentId: o.confirmed_payment_id,
      expiresAt: o.expires_at,
      expired: o.expires_at <= now,
      amount: o.total_minor,
      currency: o.currency,
      items: [
        ...items.map((i) => ({
          id: i.id,
          name: i.product_name_snapshot + ' / ' + i.sku_name_snapshot,
          price: i.price_minor,
          quantity: i.quantity,
        })),
        ...(o.shipping_fee_minor === '0'
          ? []
          : [{ id: 'shipping', name: 'Shipping VN', price: o.shipping_fee_minor, quantity: 1 }]),
      ],
      canConfirm:
        o.status === 'AWAITING_PAYMENT' &&
        o.expires_at > now &&
        event?.status === 'PUBLISHED' &&
        event.organization_status === 'APPROVED' &&
        event.public_now &&
        active &&
        stock &&
        items.length > 0 &&
        !(await r.hasRefund(db, id)),
    };
  }
  async validateAttendees(db: PoolClient, p: PaymentPurchase) {
    const o = (await this.repository.order(db, p.id))!,
      items = await this.repository.items(db, p.id);
    return (
      !items.some((i) => i.requires_ticket_snapshot) ||
      (await this.repository.ticket(db, o.customer_id, o.event_id))
    );
  }
  confirm(db: PoolClient, p: PaymentPurchase, paymentId: string) {
    return this.repository.confirm(db, p.id, paymentId);
  }
  async terminate(db: PoolClient, p: PaymentPurchase, status: 'EXPIRED' | 'CANCELLED') {
    if (p.status === 'AWAITING_PAYMENT') await this.repository.cancel(db, p.id, status);
  }
}
