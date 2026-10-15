import type { RequestHandler } from 'express';
import { authenticatedUser } from '../auth/auth.service.js';
import { numericId, paginationSchema } from '../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../shared/idempotency/idempotency.schema.js';
import { sendData } from '../../shared/http/response.js';
import { ReputationService } from './reputation.service.js';
import { reputationAdjustment, reputationReversal } from './reputation.schema.js';
export class ReputationController {
  constructor(private readonly service = new ReputationService()) {}
  read(admin: boolean): RequestHandler {
    return async (req, res) => {
      const q = paginationSchema.parse(req.query);
      sendData(
        res,
        await this.service.read(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.organizationId),
          admin,
          q.page,
          q.pageSize,
        ),
      );
    };
  }
  adjust: RequestHandler = async (req, res) => {
    const data = await this.service.adjust(
      await authenticatedUser(req.get('authorization')),
      numericId.parse(req.params.organizationId),
      reputationAdjustment.parse(req.body),
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, data);
  };
  reverse: RequestHandler = async (req, res) => {
    const q = reputationReversal.parse(req.body);
    const data = await this.service.reverse(
      await authenticatedUser(req.get('authorization')),
      numericId.parse(req.params.id),
      q.reason,
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, data);
  };
}
