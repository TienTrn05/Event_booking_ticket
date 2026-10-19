import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { noStore } from '../../shared/http/response.js';
import { sharedRateStore } from '../../shared/redis/rate-store.js';
import { createAuthController } from './http/auth.controller.js';

export function createAuthRouter() {
  const router = Router();
  const controller = createAuthController();
  const authLimit = rateLimit({
    ...sharedRateStore('auth'),
    windowMs: 60_000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  const otpSendLimit = rateLimit({
    ...sharedRateStore('otp-send'),
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });

  router.use(noStore);
  router.get('/config', controller.config);
  router.get('/csrf', controller.csrf);
  router.post('/google/start', authLimit, controller.startGoogle);
  router.post('/otp/request', otpSendLimit, controller.requestOtp);
  router.post('/otp/verify', authLimit, controller.verifyOtp);
  router.get('/google/callback', controller.googleCallback);
  router.post('/refresh', authLimit, controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/logout-all', controller.logoutAll);
  router.get('/sessions', controller.sessions);
  router.delete('/sessions/:sessionId', controller.revokeSession);
  router.get('/me', controller.me);
  router.get('/methods', controller.methods);

  return router;
}
