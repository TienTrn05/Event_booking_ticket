import { Router } from 'express';
import { noStore } from '../../../shared/http/response.js';
import { createNotificationsController } from './notifications.controller.js';

export function createNotificationsRouter() {
  const router = Router();
  const controller = createNotificationsController();
  router.use(['/users/me/following', '/organizers/:id/follow', '/notifications'], noStore);
  router.get('/users/me/following', controller.listFollowing);
  router.get('/organizers/:id/follow', controller.getFollow);
  router.put('/organizers/:id/follow', controller.follow);
  router.patch('/organizers/:id/follow', controller.setPreference);
  router.delete('/organizers/:id/follow', controller.unfollow);
  router.get('/notifications', controller.inbox);
  router.post('/notifications/:id/read', controller.readNotification);
  return router;
}
