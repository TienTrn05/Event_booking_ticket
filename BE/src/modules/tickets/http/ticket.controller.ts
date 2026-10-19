import type { RequestHandler } from 'express';
import { authenticatedUser } from '../../auth/auth.service.js';
import { numericId } from '../../../shared/validation/common.schema.js';
import { sendData } from '../../../shared/http/response.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import { checkInInput, admissionInput, lookupInput } from './ticket.schema.js';
import type { TicketService } from '../application/ticket.service.js';
export class TicketController {
  constructor(private readonly service: TicketService) {}
  list: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.list(
        await authenticatedUser(req.get('authorization')),
        req.params.bookingId ? numericId.parse(req.params.bookingId) : undefined,
      ),
    );
  get: RequestHandler = async (req, res) =>
    sendData(
      res,
      (
        await this.service.list(
          await authenticatedUser(req.get('authorization')),
          undefined,
          numericId.parse(req.params.ticketId),
        )
      )[0],
    );
  sessions: RequestHandler = async (req, res) =>
    sendData(res, await this.service.sessions(await authenticatedUser(req.get('authorization'))));
  lookup: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.lookup(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.sessionId),
        lookupInput.parse(req.body).ticketCode,
      ),
    );
  checkIn: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.checkIn(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.ticketId ?? req.params.sessionId),
        checkInInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
        req.params.ticketId ? 'ONLINE' : 'COUNTER',
      ),
    );
  admit: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.admit(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.sessionId),
        admissionInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
}
