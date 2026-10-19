import type { RequestHandler } from 'express';
import { z } from 'zod';
import { authenticatedUser } from '../../auth/auth.service.js';
import { sendData } from '../../../shared/http/response.js';
import {
  numericId,
  paginationSchema,
  versionSchema,
} from '../../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import { saleChangeInput } from './sale-change.schema.js';
import { SaleChangeService } from './sale-change.service.js';
export const saleDecision = z
  .object({ version: versionSchema, reason: z.string().trim().min(3).max(500) })
  .strict();
export class SaleChangeController {
  constructor(private readonly service = new SaleChangeService()) {}
  request: RequestHandler = async (req, res) => {
    res.status(201);
    sendData(
      res,
      await this.service.request(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.eventId),
        saleChangeInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
  list: RequestHandler = async (req, res) => {
    const q = paginationSchema.parse(req.query);
    sendData(
      res,
      await this.service.list(
        await authenticatedUser(req.get('authorization')),
        req.params.eventId ? numericId.parse(req.params.eventId) : undefined,
        q.page,
        q.pageSize,
      ),
    );
  };
  decide(action: 'approve' | 'reject' | 'withdraw'): RequestHandler {
    return async (req, res) => {
      const q = saleDecision.parse(req.body);
      sendData(
        res,
        await this.service.decide(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          action,
          q.version,
          q.reason,
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
        ),
      );
    };
  }
}
