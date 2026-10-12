import type { RequestHandler } from 'express';
import { z } from 'zod';
import { authenticatedUser } from '../../auth/auth.service.js';
import { sendData } from '../../../shared/http/response.js';
import { numericId, paginationShape } from '../../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import { OrganizationService } from '../application/organization.service.js';
import {
  organizationInput,
  organizationResubmit,
  organizationDecision,
} from './organization.schema.js';
export class OrganizationController {
  own: RequestHandler = async (req, res) =>
    sendData(res, await this.service.own(await authenticatedUser(req.get('authorization'))));
  constructor(private readonly service = new OrganizationService()) {}
  apply: RequestHandler = async (req, res) => {
    const data = await this.service.apply(
      await authenticatedUser(req.get('authorization')),
      organizationInput.parse(req.body),
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, data);
  };
  get: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.get(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
      ),
    );
  resubmit: RequestHandler = async (req, res) => {
    const input = organizationResubmit.parse(req.body);
    sendData(
      res,
      await this.service.apply(
        await authenticatedUser(req.get('authorization')),
        { name: input.name },
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
        numericId.parse(req.params.id),
        input.version,
      ),
    );
  };
  list: RequestHandler = async (req, res) => {
    const q = z
      .object({
        ...paginationShape,
        status: z
          .enum(['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'])
          .default('PENDING_REVIEW'),
      })
      .strict()
      .parse(req.query);
    sendData(
      res,
      await this.service.list(
        await authenticatedUser(req.get('authorization')),
        q.status,
        q.page,
        q.pageSize,
      ),
    );
  };
  decide(approve: boolean): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.service.decide(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          approve,
          organizationDecision.parse(req.body),
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
        ),
      );
  }
}
