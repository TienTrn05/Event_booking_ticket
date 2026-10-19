import { z } from 'zod';
import { paymentSchema } from './checkout.api';

const id = z.string();
const minor = z.string().regex(/^\d+$/);
export const merchandisePaymentSchema = paymentSchema.extend({
  bookingId: z.string().nullable(),
  merchandiseOrderId: id,
});
export const merchandiseOrderSchema = z.object({
  id,
  eventId: id,
  organizationId: id,
  status: id,
  fulfillmentStatus: id,
  totalMinor: minor,
  shippingFeeMinor: minor,
  currency: id,
  expiresAt: id,
  version: z.number().int(),
  trackingReference: id.nullable(),
  fulfillmentNote: id.nullable(),
  shippedAt: id.nullable(),
  deliveredAt: id.nullable(),
  items: z.array(
    z.object({
      id,
      sku_id: id,
      product_id: id,
      quantity: z.number().int(),
      price_minor: minor,
      product_name_snapshot: id,
      sku_name_snapshot: id,
      requires_ticket_snapshot: z.boolean(),
    }),
  ),
  payments: z.array(
    z.object({
      id,
      status: id,
      amountMinor: minor,
      receivedMinor: minor,
      reconciliationStatus: id,
      reconciliationReason: id.nullable(),
    }),
  ),
  recipient: z.object({ name: id, phone: id, address: id, country: z.literal('VN') }),
});
export const merchandiseOrdersSchema = z.object({
  total: z.number().int(),
  items: z.array(
    z.object({
      id,
      eventId: id,
      status: id,
      fulfillmentStatus: id,
      totalMinor: minor,
      currency: id,
      version: z.number().int(),
      createdAt: id,
    }),
  ),
});
export const merchandiseRefundSchema = z.object({
  id,
  status: id,
  amount_minor: minor,
  reason: id,
  created_at: id,
});
export type MerchandiseOrder = z.infer<typeof merchandiseOrderSchema>;
export type MerchandisePayment = z.infer<typeof merchandisePaymentSchema>;
export type MerchandiseOrders = z.infer<typeof merchandiseOrdersSchema>;
export type MerchandiseRefund = z.infer<typeof merchandiseRefundSchema>;
