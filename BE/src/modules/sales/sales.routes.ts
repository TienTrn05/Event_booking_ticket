import { Router } from 'express';
import { noStore } from '../../shared/http/response.js';
import { SalesController } from './sales.controller.js';
export function createSalesRouter() {
  const router = Router(),
    c = new SalesController();
  const root = '/organizer/organizations/:organizationId';
  router.get(root + '/orders', noStore, c.orders);
  router.get('/organizer/orders/:id', noStore, c.order);
  router.get(root + '/tickets', noStore, c.tickets);
  router.get(root + '/sales-summary', noStore, c.overview);
  router.get(root + '/reconciliation', noStore, c.reconciliation);
  return router;
}
