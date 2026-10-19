import type { RequestHandler } from 'express';
import { z } from 'zod';
import { authenticatedUser } from '../auth/auth.service.js';
import { sendData } from '../../shared/http/response.js';
import { numericId, versionSchema } from '../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../shared/idempotency/idempotency.schema.js';
import { SupportReportService } from './support-report.service.js';
import {
  reportInput,
  reportQuery,
  claimReportInput,
  unpublishInput,
} from './support-report.schema.js';
export class SupportReportController {
  unpublish: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.unpublish(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        unpublishInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  constructor(private readonly service = new SupportReportService()) {}
  create: RequestHandler = async (req, res) => {
    const result = await this.service.create(
      await authenticatedUser(req.get('authorization')),
      reportInput.parse(req.body),
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, result);
  };
  detail: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.detail(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
      ),
    );
  list(admin: boolean): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.service.list(
          await authenticatedUser(req.get('authorization')),
          reportQuery.parse(req.query),
          admin,
        ),
      );
  }
  claim: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.claim(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        claimReportInput.parse(req.body).version,
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  close: RequestHandler = async (req, res) => {
    const input = z
      .object({ version: versionSchema, resolution: z.string().trim().min(3).max(2000) })
      .strict()
      .parse(req.body);
    sendData(
      res,
      await this.service.close(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        input.version,
        input.resolution,
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
  booking: RequestHandler = async (req, res) => {
    const q = z.object({ reportId: numericId }).strict().parse(req.query);
    sendData(
      res,
      await this.service.booking(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        q.reportId,
        String(res.locals.requestId),
      ),
    );
  };
}
