import { Router } from 'express';
import { noStore } from '../../shared/http/response.js';
import { createOperationsController } from './operations.controller.js';
export function createOperationsRouter() {
  const router = Router(),
    controller = createOperationsController();
  router.get('/admin/statistics', noStore, controller.statistics);
  router.get('/admin/operations/health', noStore, controller.health);
  return router;
}
