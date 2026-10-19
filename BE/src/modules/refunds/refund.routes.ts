import { Router } from 'express';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import { noStore } from '../../shared/http/response.js';
import { RefundController } from './refund.controller.js';
import { refundDecision, refundResult } from './refund.schema.js';
export function createRefundRouter() {
  const router = Router(),
    c = new RefundController();
  router.use(
    [
      '/users/me/refunds',
      '/bookings/:bookingId/refunds',
      '/organizer/refunds',
      '/organizer/organizations/:organizationId/refunds',
      '/admin/refunds',
      '/bookings/:bookingId/support-reports',
      '/users/me/support-reports',
      '/admin/support-reports',
    ],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
  );
  router.post('/bookings/:bookingId/refunds', c.request);
  router.get('/users/me/refunds', c.list('self'));
  router.get('/users/me/refunds/:id', c.get('self'));
  for (const scope of ['organization', 'admin'] as const) {
    const prefix = scope === 'organization' ? '/organizer/refunds' : '/admin/refunds';
    router.get(prefix + '/:id', c.get(scope));
    for (const action of ['approve', 'reject', 'retry'] as const)
      router.post(prefix + '/:id/' + action, c.change(action, scope, refundDecision));
    router.post(prefix + '/:id/result', c.change('result', scope, refundResult));
  }
  router.get('/organizer/organizations/:organizationId/refunds', c.list('organization'));
  router.get('/admin/refunds', c.list('admin'));
  router.post('/bookings/:bookingId/support-reports', c.createReport);
  router.get('/users/me/support-reports', c.reports(false));
  router.get('/admin/support-reports', c.reports(true));
  router.post('/admin/support-reports/:id/claim', c.claimReport);
  router.post('/admin/support-reports/:id/resolve', c.closeReport);
  return router;
}
