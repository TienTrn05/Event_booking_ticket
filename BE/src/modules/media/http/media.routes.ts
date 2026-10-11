import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createActorContext } from '../../../shared/auth/request-actor.js';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { noStore } from '../../../shared/http/response.js';
import { createMediaController } from './media.controller.js';

import { sharedRateStore } from '../../../shared/redis/rate-store.js';
import { authenticatedUser } from '../../auth/auth.service.js';

export function createMediaRouter() {
  const router = Router();
  const actors = createActorContext();
  const actorFor = actors.get;
  const controller = createMediaController(actorFor);
  router.use(noStore);
  router.get('/config', controller.config);
  router.get('/avatar', controller.avatar);
  router.use(
    rateLimit({
      ...sharedRateStore('media-ip'),
      windowMs: 60_000,
      limit: 20,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  router.use(async (req, _res, next) => {
    requireAppOrigin(req);
    // Bearer JWT only; refresh and CSRF cookies retain their existing auth-only paths.
    actors.set(req, await authenticatedUser(req.get('authorization')));
    next();
  });
  router.use(
    rateLimit({
      ...sharedRateStore('media-user'),
      windowMs: 60_000,
      limit: 10,
      keyGenerator: (req) => actorFor(req).id,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  );
  router.post('/uploads', controller.createUpload);
  router.post('/uploads/complete', controller.completeUpload);
  return router;
}
