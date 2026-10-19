import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { sharedRateStore } from '../../shared/redis/rate-store.js';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import { PaymentController } from './http/payment.controller.js';
import type { PaymentService } from './application/payment.service.js';
export function createPaymentRouter(service: PaymentService) {
  const router = Router(),
    controller = new PaymentController(service);
  router.post(
    '/payments/webhooks/payos',
    rateLimit({
      windowMs: 60000,
      limit: 1000,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      ...sharedRateStore('payos-webhook', true),
    }),
    controller.webhook,
  );
  router.post(
    '/bookings/:bookingId/payments',
    (req, _res, next) => {
      requireAppOrigin(req);
      next();
    },
    controller.create,
  );
  router.get('/payments/:paymentId', controller.get);
  return router;
}
