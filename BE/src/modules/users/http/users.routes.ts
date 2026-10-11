import { Router } from 'express';
import { noStore } from '../../../shared/http/response.js';
import { createUsersController } from './users.controller.js';

export function createUsersRouter() {
  const router = Router();
  const controller = createUsersController();
  router.use(noStore);
  router.get('/me', controller.getProfile);
  router.patch('/me', controller.updateProfile);
  return router;
}
