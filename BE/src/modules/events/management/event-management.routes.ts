import { Router } from 'express';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { noStore } from '../../../shared/http/response.js';
import {
  editInput,
  layoutInput,
  zoneLayoutInput,
  zonePricingInput,
  sessionInput,
  typeInput,
  pricingInput,
  versionInput,
} from './event-management.schema.js';
import { EventManagementController } from './event-management.controller.js';
export function createEventManagementRouter() {
  const router = Router(),
    controller = new EventManagementController();
  router.get('/organizer/event-options', noStore, controller.options);
  router.use(
    ['/organizer/events', '/organizer/event-reviews', '/admin/event-reviews'],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
  );
  router.get('/organizer/events', controller.list);
  router.get('/organizer/events/:id', controller.get);
  router.get('/organizer/events/:id/reviews', controller.history(true));
  router.get('/organizer/event-reviews/:reviewId', controller.ownReview);
  router.get('/admin/event-review-history', noStore, controller.history());
  router.post('/organizer/events', controller.create);
  router.patch('/organizer/events/:id', controller.configure('edit', editInput));
  router.delete('/organizer/events/:id', controller.remove);
  router.post('/organizer/events/:id/layouts', controller.configure('layout', layoutInput));
  router.post(
    '/organizer/events/:id/zone-layouts',
    controller.configure('zone-layout', zoneLayoutInput),
  );
  router.put(
    '/organizer/events/:id/sessions/:sessionId/zone-prices',
    controller.configure('zone-prices', zonePricingInput),
  );
  router.post('/organizer/events/:id/sessions', controller.configure('session', sessionInput));
  router.patch(
    '/organizer/events/:id/sessions/:sessionId',
    controller.configure('session-edit', sessionInput),
  );
  router.post(
    '/organizer/events/:id/sessions/:sessionId/ticket-types',
    controller.configure('type', typeInput),
  );
  router.put(
    '/organizer/events/:id/sessions/:sessionId/prices',
    controller.configure('prices', pricingInput),
  );
  router.post('/organizer/events/:id/reopen', controller.configure('reopen', versionInput));
  router.post('/organizer/events/:id/submit', controller.submit);
  router.post('/organizer/event-reviews/:reviewId/withdraw', controller.withdraw);
  router.get('/admin/event-reviews', controller.pending);
  router.get('/admin/event-reviews/:id', controller.review);
  router.post('/admin/event-reviews/:id/reason', controller.reason);
  router.get('/admin/reason-notices', noStore, controller.reasonQueue);
  router.get('/admin/event-reviews/:id/reason', controller.reasonPreview);
  router.put('/admin/event-reviews/:id/reason', controller.saveReasonDraft);
  router.post('/admin/event-reviews/:id/approve', controller.decide(true));
  router.post('/admin/event-reviews/:id/reject', controller.decide(false));
  return router;
}
