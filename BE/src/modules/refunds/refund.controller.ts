import type { RequestHandler } from 'express';
import { z } from 'zod';
import { authenticatedUser } from '../auth/auth.service.js';
import { sendData } from '../../shared/http/response.js';
import { numericId, paginationShape } from '../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../shared/idempotency/idempotency.schema.js';
import { RefundService } from './refund.service.js';
import { refundInput, type RefundDecision, type RefundResult } from './refund.schema.js';
export class RefundController {
  constructor(private readonly service = new RefundService()) {}
  request: RequestHandler = async (req, res) => {
    const result = await this.service.request(
      await authenticatedUser(req.get('authorization')),
      numericId.parse(req.params.bookingId),
      refundInput.parse(req.body).reason,
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, result);
  };
  get(scope: 'self' | 'organization' | 'admin'): RequestHandler {
    return async (req, res) => {
      const q = z.object({ reportId: numericId.optional() }).strict().parse(req.query);
      sendData(
        res,
        await this.service.get(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          scope,
          q.reportId,
        ),
      );
    };
  }
  list(scope: 'self' | 'organization' | 'admin'): RequestHandler {
    return async (req, res) => {
      const q = z
        .object({ ...paginationShape, reportId: numericId.optional() })
        .strict()
        .parse(req.query);
      sendData(
        res,
        await this.service.list(
          await authenticatedUser(req.get('authorization')),
          scope,
          scope === 'organization' ? numericId.parse(req.params.organizationId) : q.reportId,
          q.page,
          q.pageSize,
        ),
      );
    };
  }
  change(
    action: Parameters<RefundService['change']>[2],
    scope: 'organization' | 'admin',
    schema: z.ZodType<RefundDecision | RefundResult>,
  ): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.service.change(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          action,
          schema.parse(req.body),
          scope,
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
        ),
      );
  }
  createReport: RequestHandler = async (req, res) => {
    const result = await this.service.createReport(
      await authenticatedUser(req.get('authorization')),
      numericId.parse(req.params.bookingId),
      z
        .object({ reason: z.string().trim().min(3).max(2000) })
        .strict()
        .parse(req.body).reason,
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, result);
  };
  reports(admin: boolean): RequestHandler {
    return async (req, res) => {
      const q = z.object(paginationShape).strict().parse(req.query);
      sendData(
        res,
        await this.service.reports(
          await authenticatedUser(req.get('authorization')),
          admin,
          q.page,
          q.pageSize,
        ),
      );
    };
  }
  claimReport: RequestHandler = async (req, res) => {
    z.object({}).strict().parse(req.body);
    sendData(
      res,
      await this.service.claimReport(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
  closeReport: RequestHandler = async (req, res) => {
    const input = z
      .object({
        version: z.number().int().nonnegative(),
        resolution: z.string().trim().min(3).max(2000),
      })
      .strict()
      .parse(req.body);
    sendData(
      res,
      await this.service.closeReport(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        input.version,
        input.resolution,
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
}
