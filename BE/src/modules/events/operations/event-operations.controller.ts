import type { RequestHandler } from 'express';
import { authenticatedUser } from '../../auth/auth.service.js';
import { numericId } from '../../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import { sendData } from '../../../shared/http/response.js';
import { EventOperationsService } from './event-operations.service.js';
import { contentChange, operationDecision, changeList } from './event-operations.schema.js';
export class EventOperationsController {
  detail(admin: boolean): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.service.detail(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.changeId),
          admin,
        ),
      );
  }
  progress: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.progress(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
      ),
    );
  constructor(private readonly service = new EventOperationsService()) {}
  request: RequestHandler = async (req, res) => {
    const result = await this.service.request(
      await authenticatedUser(req.get('authorization')),
      numericId.parse(req.params.id),
      contentChange.parse(req.body),
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, result);
  };
  list: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.list(
        await authenticatedUser(req.get('authorization')),
        req.params.id ? numericId.parse(req.params.id) : undefined,
        changeList.parse(req.query),
      ),
    );
  decision(action: 'approve' | 'reject' | 'withdraw'): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.service.decide(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.changeId),
          action,
          operationDecision.parse(req.body),
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
        ),
      );
  }
  cancel: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.cancel(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        operationDecision.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
}
