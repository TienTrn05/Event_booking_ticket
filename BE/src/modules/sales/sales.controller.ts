import type { RequestHandler } from 'express';
import { authenticatedUser } from '../auth/auth.service.js';
import { numericId } from '../../shared/validation/common.schema.js';
import { sendData } from '../../shared/http/response.js';
import { SalesService } from './sales.service.js';
import { ordersQuery, ticketsQuery, overviewQuery, reconciliationQuery } from './sales.schema.js';
export class SalesController {
  constructor(private readonly service = new SalesService()) {}
  orders: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.orders(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.organizationId),
        ordersQuery.parse(req.query),
      ),
    );
  order: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.order(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
      ),
    );
  tickets: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.tickets(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.organizationId),
        ticketsQuery.parse(req.query),
      ),
    );
  overview: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.overview(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.organizationId),
        overviewQuery.parse(req.query),
      ),
    );
  reconciliation: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.reconciliation(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.organizationId),
        reconciliationQuery.parse(req.query),
      ),
    );
}
