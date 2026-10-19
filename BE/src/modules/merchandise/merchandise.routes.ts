import { Router } from 'express';
import { noStore } from '../../shared/http/response.js';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import type { PaymentService } from '../payments/application/payment.service.js';
import { MerchandiseController } from './merchandise.controller.js';
export function createMerchandiseRouter(payments: PaymentService) {
  const r = Router(),
    c = new MerchandiseController(payments);
  r.get('/merchandise/:publicId/skus', noStore, c.publicSkus);
  r.use(
    [
      '/organizer/merchandise',
      '/organizer/merchandise-skus',
      '/organizer/merchandise-orders',
      '/organizer/merchandise-refunds',
      '/organizer/events/:eventId/merchandise',
      '/organizer/organizations/:organizationId/merchandise-orders',
      '/merchandise-orders',
      '/users/me/merchandise-orders',
      '/admin/merchandise',
      '/admin/merchandise-orders',
      '/admin/merchandise-payments',
      '/admin/merchandise-refunds',
    ],
    noStore,
    (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      next();
    },
  );
  r.get('/organizer/events/:eventId/merchandise', c.products);
  r.post('/organizer/events/:eventId/merchandise', c.createProduct);
  r.get('/organizer/merchandise/:id', c.product());
  r.patch('/organizer/merchandise/:id', c.changeProduct('edit'));
  for (const a of ['submit', 'archive'] as const)
    r.post('/organizer/merchandise/:id/' + a, c.changeProduct(a));
  r.post('/organizer/merchandise-skus/:id/stock', c.stock);
  r.get('/admin/merchandise', c.products);
  r.get('/admin/merchandise/:id', c.product(true));
  for (const a of ['approve', 'reject'] as const)
    r.post('/admin/merchandise/:id/' + a, c.changeProduct(a));
  r.post('/merchandise-orders', c.createOrder);
  r.get('/users/me/merchandise-orders', c.orders);
  r.get('/users/me/merchandise-orders/:id', c.order('self'));
  r.post('/merchandise-orders/:id/cancel', c.cancel);
  r.post('/merchandise-orders/:id/payments', c.pay);
  r.get('/organizer/organizations/:organizationId/merchandise-orders', c.orders);
  r.get('/organizer/organizations/:organizationId/merchandise-sales', noStore, c.overview);
  r.get('/organizer/merchandise-orders/:id', c.order('organizer'));
  r.post('/organizer/merchandise-orders/:id/fulfillment', c.fulfill);
  r.get('/admin/merchandise-orders/:id', c.order('admin'));
  r.post('/merchandise-orders/:id/refunds', c.requestRefund);
  r.get('/users/me/merchandise-orders/:id/refunds', c.listRefunds('self'));
  for (const s of ['organizer', 'admin'] as const) {
    r.get('/' + s + '/merchandise-orders/:id/refunds', c.listRefunds(s));
    for (const a of ['approve', 'reject', 'retry', 'result'] as const)
      r.post('/' + s + '/merchandise-refunds/:id/' + a, c.changeRefund(a, s));
  }
  r.post('/admin/merchandise-payments/:id/refunds', c.compensate);
  return r;
}
