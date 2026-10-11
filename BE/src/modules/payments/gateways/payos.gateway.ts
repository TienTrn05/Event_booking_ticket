import type { PayOS } from '@payos/node';
import { z } from 'zod';
import { AppError } from '../../../shared/errors/app-error.js';
import type {
  PaymentGateway,
  PaymentRequest,
  PaymentLink,
  Receipt,
} from '../application/payment.ports.js';
const amount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const identifier = z
  .string()
  .min(1)
  .max(191)
  .regex(/^[A-Za-z0-9_-]+$/);
const linkSchema = z.object({ orderCode: amount, id: identifier, amount });
const receiptSchema = z.object({
  orderCode: amount,
  amount,
  reference: z.string().min(1).max(191),
  paymentLinkId: identifier,
  currency: z.string().max(8),
  code: z.string().max(16),
});
export class PayosGateway implements PaymentGateway {
  constructor(private readonly client: PayOS) {}
  private link(raw: unknown): PaymentLink {
    const parsed = linkSchema.parse(raw);
    return { ...parsed, checkoutUrl: `https://pay.payos.vn/web/${parsed.id}` };
  }
  async create(input: PaymentRequest) {
    const raw = await this.client.paymentRequests.create(input);
    return this.link({ ...raw, id: raw.paymentLinkId });
  }
  async find(orderCode: number) {
    return this.link(await this.client.paymentRequests.get(orderCode));
  }
  async status(orderCode: number) {
    const raw = await this.client.paymentRequests.get(orderCode);
    const link = this.link(raw);
    return {
      link,
      status: raw.status,
      amountPaid: amount.parse(raw.amountPaid),
      receipts: raw.transactions.map((t) => ({
        orderCode: String(link.orderCode),
        amount: String(amount.parse(t.amount)),
        reference: z.string().min(1).max(191).parse(t.reference),
        paymentLinkId: link.id,
        currency: 'VND',
        code: '00',
      })),
    };
  }
  async verify(payload: unknown): Promise<Receipt> {
    try {
      const body = z
        .object({
          code: z.string(),
          desc: z.string(),
          success: z.boolean(),
          data: z.record(z.string(), z.unknown()),
          signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
        })
        .parse(payload);
      const verified = await this.client.webhooks.verify(
        body as Parameters<PayOS['webhooks']['verify']>[0],
      );
      const data = receiptSchema.parse(verified);
      return { ...data, orderCode: String(data.orderCode), amount: String(data.amount) };
    } catch {
      throw new AppError(400, 'INVALID_PAYMENT_WEBHOOK', 'Webhook thanh toán không hợp lệ.');
    }
  }
}
