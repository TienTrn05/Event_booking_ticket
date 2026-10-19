import { Router } from 'express';
import { noStore } from '../../../shared/http/response.js';
import { createAttendeeController } from './attendee.controller.js';
export function createAttendeeRouter() {
  const router = Router();
  const controller = createAttendeeController();
  router.use(['/bookings/:id/attendees', '/tickets/:id/attendee-verification'], noStore);
  router.get('/bookings/:id/attendees', controller.getAttendees);
  router.put('/bookings/:id/attendees', controller.saveAttendees);
  router.post('/tickets/:id/attendee-verification', controller.verifyAttendee);
  return router;
}
