import type { RequestHandler } from 'express';
import { numericId, publicId as publicIdSchema } from '../../../shared/validation/common.schema.js';
import { publicSeats, publicSessions } from './inventory.service.js';
export function createInventoryController() {
  const sessionsHandler: RequestHandler = async (req, res) => {
    res.json({
      data: await publicSessions(publicIdSchema.parse(req.params.eventId)),
      meta: { requestId: res.locals.requestId },
    });
  };

  const seatsHandler: RequestHandler = async (req, res) => {
    res.json({
      data: await publicSeats(
        publicIdSchema.parse(req.params.eventId),
        numericId.parse(req.params.sessionId),
      ),
      meta: { requestId: res.locals.requestId },
    });
  };
  return { sessions: sessionsHandler, seats: seatsHandler };
}
