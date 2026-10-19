import { Router } from 'express';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import { TicketController } from './http/ticket.controller.js';
import type { TicketService } from './application/ticket.service.js';
export function createTicketRouter(service: TicketService) {
  const router = Router(),
    controller = new TicketController(service);
  router.get('/users/me/tickets', controller.list);
  router.get('/bookings/:bookingId/tickets', controller.list);
  router.get('/tickets/:ticketId', controller.get);
  router.get('/organizer/ticket-sessions', controller.sessions);
  router.use(
    [
      '/tickets/:ticketId/check-in',
      '/sessions/:sessionId/check-ins',
      '/sessions/:sessionId/admissions',
      '/sessions/:sessionId/ticket-lookup',
    ],
    (req, _res, next) => {
      requireAppOrigin(req);
      next();
    },
  );
  router.post('/sessions/:sessionId/ticket-lookup', controller.lookup);
  router.post('/tickets/:ticketId/check-in', controller.checkIn);
  router.post('/sessions/:sessionId/check-ins', controller.checkIn);
  router.post('/sessions/:sessionId/admissions', controller.admit);
  return router;
}
