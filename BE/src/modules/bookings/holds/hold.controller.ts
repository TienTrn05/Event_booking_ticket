import type { Request, RequestHandler } from 'express';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { numericId, publicId as publicIdSchema } from '../../../shared/validation/common.schema.js';
import * as service from '../booking.service.js';
import type { AdmissionGate } from '../shared/booking.types.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import { returnAdmission } from '../waiting-room/waiting-room.service.js';
import { holdInput } from './hold.schema.js';
export function createHoldController(
  actorFor: (req: Request) => RequestActor,
  admissionGate: AdmissionGate,
) {
  const createHoldHandler: RequestHandler = async (req, res) => {
    const actor = actorFor(req);
    const input = holdInput.parse(req.body);
    const publicId = publicIdSchema.parse(req.params.eventId);
    const sessionId = numericId.parse(req.params.sessionId);
    const result = await service.createHold(
      actor,
      publicId,
      sessionId,
      input.seatIds,
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
      () => admissionGate(req, actor, publicId, sessionId),
    );
    await returnAdmission(sessionId, actor.id);
    if (result.replayed) res.setHeader('Idempotency-Replayed', 'true');
    res
      .status(result.status)
      .json({ data: result.data, meta: { requestId: res.locals.requestId } });
  };

  const getHoldHandler: RequestHandler = async (req, res) =>
    res.json({
      data: await service.getHold(actorFor(req), numericId.parse(req.params.holdId)),
      meta: { requestId: res.locals.requestId },
    });

  const releaseHoldHandler: RequestHandler = async (req, res) => {
    await service.releaseHold(
      actorFor(req),
      numericId.parse(req.params.holdId),
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.sendStatus(204);
  };
  return {
    createHold: createHoldHandler,
    getHold: getHoldHandler,
    releaseHold: releaseHoldHandler,
  };
}
