import { z } from 'zod';
import {
  numericId,
  versionSchema,
  paginationShape,
} from '../../shared/validation/common.schema.js';
const money = z.string().regex(/^(0|[1-9][0-9]{0,11})$/);
export const productInput = z
  .object({
    name: z.string().trim().min(1).max(180),
    description: z.string().trim().max(2000),
    requiresTicket: z.boolean(),
    shippingFeeMinor: money,
    skus: z
      .array(
        z
          .object({
            code: z.string().trim().min(1).max(80),
            name: z.string().trim().min(1).max(180),
            priceMinor: money.refine((n) => BigInt(n) > 0n),
            stockTotal: z.number().int().min(0).max(1000000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine((p) => new Set(p.skus.map((s) => s.code)).size === p.skus.length, 'Duplicate SKU code');
export const productUpdate = z.object({ version: versionSchema, product: productInput }).strict();
export const productDecision = z
  .object({ version: versionSchema, reason: z.string().trim().min(3).max(500) })
  .strict();
export const stockInput = z
  .object({ version: versionSchema, stockTotal: z.number().int().min(0).max(1000000) })
  .strict();
export const recipientInput = z
  .object({
    name: z.string().trim().min(2).max(180),
    phone: z.string().regex(/^(0|\+84)[0-9]{9}$/),
    address: z.string().trim().min(10).max(1000),
    country: z.literal('VN'),
  })
  .strict();
export const orderInput = z
  .object({
    eventId: numericId,
    items: z
      .array(z.object({ skuId: numericId, quantity: z.number().int().min(1).max(20) }).strict())
      .min(1)
      .max(20),
    recipient: recipientInput,
  })
  .strict()
  .refine(
    (o) =>
      o.items.reduce((n, i) => n + i.quantity, 0) <= 20 &&
      new Set(o.items.map((i) => i.skuId)).size === o.items.length,
    'Maximum 20 units and no duplicate SKU',
  );
export const fulfillmentInput = z
  .object({
    version: versionSchema,
    status: z.enum(['SHIPPED', 'DELIVERED', 'DELIVERY_FAILED']),
    reference: z.string().trim().min(3).max(191),
    note: z.string().trim().min(3).max(2000),
  })
  .strict();
export const merchandiseQuery = z
  .object({
    ...paginationShape,
    status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED']).optional(),
  })
  .strict();
export type ProductInput = z.infer<typeof productInput>;
export type OrderInput = z.infer<typeof orderInput>;
export type Recipient = z.infer<typeof recipientInput>;
export type FulfillmentInput = z.infer<typeof fulfillmentInput>;
