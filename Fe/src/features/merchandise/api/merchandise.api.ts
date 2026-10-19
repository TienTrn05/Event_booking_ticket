import { z } from 'zod';
import { apiRequest } from '../../../shared/api/client';
const numericId = z.string().regex(/^[1-9][0-9]*$/);
const money = z.string().regex(/^\d+$/);
export const publicSkusSchema = z.object({
  eventId: numericId,
  productId: numericId,
  shippingFeeMinor: money,
  skus: z.array(
    z.object({
      id: numericId,
      code: z.string(),
      name: z.string(),
      priceMinor: money,
      currency: z.string().length(3),
      available: z.number().int().nonnegative(),
    }),
  ),
});
export type PublicSkus = z.infer<typeof publicSkusSchema>;
export const orderInputSchema = z.object({
  eventId: numericId,
  items: z
    .array(z.object({ skuId: numericId, quantity: z.number().int().min(1).max(20) }))
    .min(1)
    .max(20),
  recipient: z.object({
    name: z.string().trim().min(2).max(180),
    phone: z.string().regex(/^(0|\+84)[0-9]{9}$/),
    address: z.string().trim().min(10).max(1000),
    country: z.literal('VN'),
  }),
});
export async function createMerchandiseOrder(body: string, key: string, token: string) {
  const response = await apiRequest('/merchandise-orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body,
  });
  return z.object({ data: z.object({ id: numericId }) }).parse(response).data;
}
