import type { RequestHandler } from 'express';
import { z } from 'zod';
import { authenticatedUser } from '../auth/auth.service.js';
import { sendData } from '../../shared/http/response.js';
import { numericId, paginationShape } from '../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../shared/idempotency/idempotency.schema.js';
import { FeedbackService } from './feedback.service.js';
import { feedbackInput } from './feedback.schema.js';
export class FeedbackController {
  constructor(private readonly service = new FeedbackService()) {}
  create: RequestHandler = async (req, res) => {
    const result = await this.service.create(
      await authenticatedUser(req.get('authorization')),
      feedbackInput.parse(req.body),
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, result);
  };
  get(scope: 'self' | 'organization' | 'admin'): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.service.get(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          scope,
        ),
      );
  }
  list(scope: 'self' | 'organization' | 'admin'): RequestHandler {
    return async (req, res) => {
      const q = z
        .object({
          ...paginationShape,
          ...(scope === 'admin' ? { kind: z.enum(['SYSTEM', 'ORGANIZATION']).optional() } : {}),
        })
        .strict()
        .parse(req.query);
      const id =
        scope === 'organization'
          ? numericId.parse(req.params.organizationId)
          : scope === 'admin' && 'kind' in q
            ? (q.kind as string)
            : null;
      sendData(
        res,
        await this.service.list(
          await authenticatedUser(req.get('authorization')),
          scope,
          id ?? null,
          q.page,
          q.pageSize,
        ),
      );
    };
  }
  change(
    action: Parameters<FeedbackService['change']>[2],
    schema: z.ZodType<Parameters<FeedbackService['change']>[3]>,
  ): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.service.change(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          action,
          schema.parse(req.body),
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
        ),
      );
  }
}
