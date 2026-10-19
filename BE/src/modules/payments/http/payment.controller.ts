import type { RequestHandler } from 'express';
import { authenticatedUser } from '../../auth/auth.service.js';
import { emptyBodySchema, numericId } from '../../../shared/validation/common.schema.js';
import { sendData } from '../../../shared/http/response.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import type { PaymentService } from '../application/payment.service.js';
export class PaymentController {
  constructor(private readonly service: PaymentService) {}
  create: RequestHandler = async (req, res) => {
    emptyBodySchema.parse(req.body ?? {});
    res.status(201);
    sendData(
      res,
      await this.service.start(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.bookingId),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
  get: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.get(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.paymentId),
      ),
    );
  webhook: RequestHandler = async (req, res) => {
    await this.service.webhook(req.body);
    res.status(200).json({ success: true });
  };
}
