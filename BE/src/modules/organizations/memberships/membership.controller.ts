import type { RequestHandler } from 'express';
import { authenticatedUser } from '../../auth/auth.service.js';
import { sendData } from '../../../shared/http/response.js';
import { numericId, paginationSchema } from '../../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../../shared/idempotency/idempotency.schema.js';
import { invitationInput, membershipDecision } from './membership.schema.js';
import { MembershipService } from './membership.service.js';
export class MembershipController {
  constructor(private readonly service = new MembershipService()) {}
  list: RequestHandler = async (req, res) => {
    const q = paginationSchema.parse(req.query);
    sendData(
      res,
      await this.service.list(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.organizationId),
        q.page,
        q.pageSize,
      ),
    );
  };
  invitations: RequestHandler = async (req, res) => {
    const q = paginationSchema.parse(req.query);
    sendData(
      res,
      await this.service.invitations(
        await authenticatedUser(req.get('authorization')),
        q.page,
        q.pageSize,
      ),
    );
  };
  invite: RequestHandler = async (req, res) => {
    const data = await this.service.invite(
      await authenticatedUser(req.get('authorization')),
      numericId.parse(req.params.organizationId),
      invitationInput.parse(req.body),
      idempotencyKey.parse(req.get('idempotency-key')),
      String(res.locals.requestId),
    );
    res.status(201);
    sendData(res, data);
  };
  change(action: 'accept' | 'decline' | 'revoke'): RequestHandler {
    return async (req, res) => {
      const q = membershipDecision.parse(req.body);
      sendData(
        res,
        await this.service.change(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          q.version,
          action,
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
        ),
      );
    };
  }
}
