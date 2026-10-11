import type { Request, RequestHandler } from 'express';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { sendData } from '../../../shared/http/response.js';
import { numericId, paginationSchema } from '../../../shared/validation/common.schema.js';
import * as service from '../booking.service.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import { bookingInput, cancelInput } from './booking.schema.js';
export function createBookingController(actorFor: (req: Request) => RequestActor) {
  const createBookingHandler: RequestHandler = async (req, res) => {
    const result = await service.createBooking(
      actorFor(req),
      bookingInput.parse(req.body),
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    if (result.replayed) res.setHeader('Idempotency-Replayed', 'true');
    res
      .status(result.status)
      .json({ data: result.data, meta: { requestId: res.locals.requestId } });
  };

  const listBookingsHandler: RequestHandler = async (req, res) => {
    const page = paginationSchema.parse(req.query);
    const result = await service.listBookings(actorFor(req), page.page, page.pageSize);
    res.json({
      data: result.items,
      meta: { requestId: res.locals.requestId, pagination: result.pagination },
    });
  };

  const getBookingHandler: RequestHandler = async (req, res) =>
    res.json({
      data: await service.getBooking(actorFor(req), numericId.parse(req.params.bookingId)),
      meta: { requestId: res.locals.requestId },
    });

  const cancelBookingHandler: RequestHandler = async (req, res) => {
    const input = cancelInput.parse(req.body);
    const data = await service.cancelBooking(
      actorFor(req),
      numericId.parse(req.params.bookingId),
      input.reason,
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    sendData(res, data);
  };
  return {
    createBooking: createBookingHandler,
    listBookings: listBookingsHandler,
    getBooking: getBookingHandler,
    cancelBooking: cancelBookingHandler,
  };
}
