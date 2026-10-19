import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createActorContext } from '../../shared/auth/request-actor.js';
import { requireAppOrigin } from '../../shared/http/private-request.js';
import { sharedRateStore } from '../../shared/redis/rate-store.js';
import { authenticatedUser } from '../auth/auth.service.js';
import { createHoldController } from './holds/hold.controller.js';
import { createInventoryController } from './inventory/inventory.controller.js';
import { createBookingController } from './orders/booking.controller.js';
import { createWaitingRoomController } from './waiting-room/waiting-room.controller.js';

import type { AdmissionGate } from './shared/booking.types.js';
export function createBookingRouter(admissionGate: AdmissionGate) {
  const router = Router();
  const actors = createActorContext();
  const actorFor = actors.get;
  const controller = {
    ...createInventoryController(),
    ...createWaitingRoomController(actorFor),
    ...createHoldController(actorFor, admissionGate),
    ...createBookingController(actorFor),
  };
  router.get('/events/:eventId/sessions', controller.sessions);
  router.get('/events/:eventId/sessions/:sessionId/seats', controller.seats);
  router.use(
    [
      '/holds',
      '/bookings',
      '/events/:eventId/sessions/:sessionId/seats/hold',
      '/events/:eventId/sessions/:sessionId/zones/hold',
    ],
    async (req, _res, next) => {
      if (req.method !== 'GET') requireAppOrigin(req);
      actors.set(req, await authenticatedUser(req.get('authorization')));
      next();
    },
  );
  router.use('/events/:eventId/sessions/:sessionId/waiting-room', async (req, _res, next) => {
    if (req.method !== 'GET') requireAppOrigin(req);
    actors.set(req, await authenticatedUser(req.get('authorization')));
    next();
  });
  const queueLimit = rateLimit({
    windowMs: 60_000,
    limit: 6,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => actorFor(req).id,
    ...sharedRateStore('waiting-room'),
  });
  router.all(
    '/events/:eventId/sessions/:sessionId/waiting-room',
    queueLimit,
    controller.waitingRoom,
  );
  const mutationLimit = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => actorFor(req).id,
    ...sharedRateStore('booking-mutation'),
  });
  // Existing holds can still be read/released/converted/cancelled when Redis is down.
  // Only new allocation uses this strict shared limiter and admission gate.
  router.post(
    '/events/:eventId/sessions/:sessionId/seats/hold',
    mutationLimit,
    controller.createHold,
  );
  router.post(
    '/events/:eventId/sessions/:sessionId/zones/hold',
    mutationLimit,
    controller.createZoneHold,
  );
  router.get('/events/:eventId/sessions/:sessionId/zones', controller.zones);
  router.get('/holds/:holdId', controller.getHold);
  router.delete('/holds/:holdId', controller.releaseHold);
  router.post('/bookings', controller.createBooking);
  router.get('/bookings', controller.listBookings);
  router.get('/bookings/:bookingId', controller.getBooking);
  router.post('/bookings/:bookingId/cancel', controller.cancelBooking);
  return router;
}
