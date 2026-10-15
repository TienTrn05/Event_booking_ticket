import { Router } from 'express';
import { noStore } from '../../shared/http/response.js';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import { ReputationController } from './reputation.controller.js';
export function createReputationRouter() {
  const router = Router(),
    controller = new ReputationController();
  router.use(
    [
      '/admin/organizations/:organizationId/reputation',
      '/organizer/organizations/:organizationId/reputation',
      '/admin/reputation',
    ],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
  );
  router.get('/admin/organizations/:organizationId/reputation', controller.read(true));
  router.get('/organizer/organizations/:organizationId/reputation', controller.read(false));
  router.post('/admin/organizations/:organizationId/reputation/adjustments', controller.adjust);
  router.post('/admin/reputation/:id/reverse', controller.reverse);
  return router;
}
