import type { Request, RequestHandler } from 'express';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { sendData } from '../../../shared/http/response.js';
import {
  emptyBodySchema,
  numericId,
  publicId as publicIdSchema,
} from '../../../shared/validation/common.schema.js';
import { waitingRoom } from './waiting-room.service.js';
export function createWaitingRoomController(actorFor: (req: Request) => RequestActor) {
  const waitingRoomHandler: RequestHandler = async (req, res, next) => {
    if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
      next();
      return;
    }
    if (req.method === 'POST') emptyBodySchema.parse(req.body ?? {});
    const data = await waitingRoom(
      actorFor(req),
      publicIdSchema.parse(req.params.eventId),
      numericId.parse(req.params.sessionId),
      req.method === 'POST' ? 'join' : req.method === 'DELETE' ? 'leave' : 'status',
    );
    res.setHeader('Retry-After', String(data.pollAfterSeconds));
    sendData(res, data);
  };
  return { waitingRoom: waitingRoomHandler };
}
