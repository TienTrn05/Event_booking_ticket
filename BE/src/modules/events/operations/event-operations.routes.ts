import { Router } from 'express';
import { noStore } from '../../../shared/http/response.js';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { EventOperationsController } from './event-operations.controller.js';
export function createEventOperationsRouter() {
  const router = Router(),
    c = new EventOperationsController();
  router.use(
    ['/organizer/events', '/organizer/event-changes', '/admin/event-changes'],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
  );
  router.get('/organizer/events/:id/content-changes', c.list);
  router.get('/organizer/events/:id/operations', c.progress);
  router.post('/organizer/events/:id/content-changes', c.request);
  router.post('/organizer/events/:id/cancel', c.cancel);
  router.post('/organizer/event-changes/:changeId/withdraw', c.decision('withdraw'));
  router.get('/admin/event-changes', c.list);
  router.get('/admin/event-changes/:changeId', c.detail(true));
  router.get('/organizer/event-changes/:changeId', c.detail(false));
  router.post('/admin/event-changes/:changeId/approve', c.decision('approve'));
  router.post('/admin/event-changes/:changeId/reject', c.decision('reject'));
  return router;
}
