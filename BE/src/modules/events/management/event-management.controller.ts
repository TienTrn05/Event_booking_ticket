import type { RequestHandler } from 'express';
import { z } from 'zod';
import { authenticatedUser } from '../../auth/auth.service.js';
import { sendData } from '../../../shared/http/response.js';
import { numericId } from '../../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import { draftInput, versionInput, reviewDecision } from './event-management.schema.js';
import { EventManagementService } from './event-management.service.js';
export class EventManagementController {
  options: RequestHandler = async (req, res) =>
    sendData(res, await this.service.options(await authenticatedUser(req.get('authorization'))));
  constructor(private readonly service = new EventManagementService()) {}
  list: RequestHandler = async (req, res) => {
    z.object({}).strict().parse(req.query);
    sendData(res, await this.service.list(await authenticatedUser(req.get('authorization'))));
  };
  get: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.get(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
      ),
    );
  create: RequestHandler = async (req, res) => {
    const data = await this.service.create(
      await authenticatedUser(req.get('authorization')),
      draftInput.parse(req.body),
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, data);
  };
  configure(
    kind: Parameters<EventManagementService['configure']>[2],
    schema: z.ZodType<{ version: number }>,
  ): RequestHandler {
    return async (req, res) => {
      const input = schema.parse(req.body);
      sendData(
        res,
        await this.service.configure(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          kind,
          input,
          input.version,
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
          req.params.sessionId ? numericId.parse(req.params.sessionId) : undefined,
        ),
      );
    };
  }
  submit: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.submit(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        versionInput.parse(req.body).version,
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  withdraw: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.decide(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.reviewId),
        'WITHDRAWN',
        versionInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  pending: RequestHandler = async (req, res) => {
    z.object({}).strict().parse(req.query);
    sendData(res, await this.service.pending(await authenticatedUser(req.get('authorization'))));
  };
  review: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.review(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
      ),
    );
  reason: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.sendReason(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        reviewDecision.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  decide(approve: boolean): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.service.decide(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          approve ? 'APPROVED' : 'REJECTED',
          reviewDecision.parse(req.body),
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
        ),
      );
  }
}
