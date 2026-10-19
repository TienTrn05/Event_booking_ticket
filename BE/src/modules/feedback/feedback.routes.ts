import { Router } from 'express';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import { noStore } from '../../shared/http/response.js';
import { FeedbackController } from './feedback.controller.js';
import {
  feedbackEdit,
  feedbackReply,
  feedbackHandle,
  feedbackModerate,
} from './feedback.schema.js';
export function createFeedbackRouter() {
  const router = Router(),
    c = new FeedbackController();
  router.use(
    [
      '/feedback',
      '/users/me/feedback',
      '/organizer/feedback',
      '/organizer/organizations/:organizationId/feedback',
      '/admin/feedback',
    ],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
  );
  router.post('/feedback', c.create);
  router.get('/users/me/feedback', c.list('self'));
  router.get('/users/me/feedback/:id', c.get('self'));
  router.patch('/users/me/feedback/:id', c.change('edit', feedbackEdit));
  router.get('/organizer/organizations/:organizationId/feedback', c.list('organization'));
  router.get('/organizer/feedback/:id', c.get('organization'));
  router.post('/organizer/feedback/:id/reply', c.change('reply', feedbackReply));
  router.get('/admin/feedback', c.list('admin'));
  router.get('/admin/feedback/:id', c.get('admin'));
  router.post('/admin/feedback/:id/handle', c.change('handle', feedbackHandle));
  router.post('/admin/feedback/:id/moderate', c.change('moderate', feedbackModerate));
  return router;
}
