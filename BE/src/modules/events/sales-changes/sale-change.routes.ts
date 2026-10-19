import { Router, json } from 'express';
import { noStore } from '../../../shared/http/response.js';
import { requireAppOrigin } from '../../../shared/http/private-request.js';
import { SaleChangeController } from './sale-change.controller.js';
export function createSaleChangeRouter() {
  const r = Router(),
    c = new SaleChangeController();
  r.use(
    ['/organizer/events/:eventId/sale-changes', '/organizer/sale-changes', '/admin/sale-changes'],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
    json({ limit: '1mb' }),
  );
  r.get('/organizer/events/:eventId/sale-changes', c.list);
  r.post('/organizer/events/:eventId/sale-changes', c.request);
  r.get('/admin/sale-changes', c.list);
  r.post('/organizer/sale-changes/:id/withdraw', c.decide('withdraw'));
  for (const a of ['approve', 'reject'] as const)
    r.post('/admin/sale-changes/:id/' + a, c.decide(a));
  return r;
}
