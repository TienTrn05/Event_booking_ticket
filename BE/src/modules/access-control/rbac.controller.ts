import type { RequestHandler } from 'express';
import { authenticatedUser } from '../auth/auth.service.js';
import { sendData } from '../../shared/http/response.js';
import { idempotencyKey } from '../../shared/idempotency/idempotency.schema.js';
import { numericId } from '../../shared/validation/common.schema.js';
import {
  archiveRoleInput,
  assignmentInput,
  auditQuery,
  createRoleInput,
  rolesQuery,
  updateRoleInput,
  usersQuery,
} from './rbac.schema.js';
import { RbacService } from './rbac.service.js';
export class RbacController {
  constructor(private readonly service = new RbacService()) {}
  roles: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.roles(
        await authenticatedUser(req.get('authorization')),
        rolesQuery.parse(req.query),
      ),
    );
  permissions: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.permissions(await authenticatedUser(req.get('authorization'))),
    );
  users: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.users(
        await authenticatedUser(req.get('authorization')),
        usersQuery.parse(req.query),
      ),
    );
  user: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.user(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.userId),
      ),
    );
  audits: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.audits(
        await authenticatedUser(req.get('authorization')),
        auditQuery.parse(req.query),
      ),
    );
  create: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.create(
        await authenticatedUser(req.get('authorization')),
        createRoleInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  update: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.update(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.roleId),
        updateRoleInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  archive: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.archive(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.roleId),
        archiveRoleInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  grant: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.assignment(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.userId),
        numericId.parse(req.params.roleId),
        true,
        assignmentInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  revoke: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.assignment(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.userId),
        numericId.parse(req.params.roleId),
        false,
        assignmentInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
}
