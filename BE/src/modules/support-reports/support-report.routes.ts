import { Router } from 'express';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import { noStore } from '../../shared/http/response.js';
import { SupportReportController } from './support-report.controller.js';
export function createSupportReportRouter() {
  const router = Router(),
    c = new SupportReportController();
  router.use(
    ['/reports', '/admin/reports', '/admin/bookings', '/admin/events'],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
  );
  router.post('/reports', c.create);
  router.get('/reports', c.list(false));
  router.get('/reports/:id', c.detail);
  router.get('/admin/reports', c.list(true));
  router.post('/admin/reports/:id/claim', c.claim);
  router.post('/admin/reports/:id/resolve', c.close);
  router.get('/admin/bookings/:id', c.booking);
  router.post('/admin/events/:id/unpublish', c.unpublish);
  return router;
}
