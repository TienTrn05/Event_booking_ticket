import type { RequestHandler } from 'express';
import { z } from 'zod';
import { statisticsQuery } from '../operations/operations.schema.js';
import { authenticatedUser } from '../auth/auth.service.js';
import { sendData } from '../../shared/http/response.js';
import {
  numericId,
  paginationSchema,
  versionSchema,
} from '../../shared/validation/common.schema.js';
import { idempotencyKey } from '../../shared/idempotency/idempotency.schema.js';
import type { PaymentService } from '../payments/application/payment.service.js';
import { refundInput, refundDecision, refundResult } from '../refunds/refund.schema.js';
import { MerchandiseService } from './merchandise.service.js';
import { MerchandiseRefundService } from './merchandise-refund.service.js';
import {
  productInput,
  productUpdate,
  productDecision,
  stockInput,
  orderInput,
  fulfillmentInput,
  merchandiseQuery,
} from './merchandise.schema.js';
export const orderVersion = z.object({ version: versionSchema }).strict();
export const compensationInput = z
  .object({ reportId: numericId, reason: z.string().trim().min(3).max(500) })
  .strict();
const reportScope = z.object({ reportId: numericId.optional() }).strict();
export class MerchandiseController {
  overview: RequestHandler = async (req, res) => {
    const q = statisticsQuery.parse(req.query);
    sendData(
      res,
      await this.service.overview(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.organizationId),
        q.from,
        q.to,
      ),
    );
  };
  constructor(
    private readonly payments: PaymentService,
    private readonly service = new MerchandiseService(),
    private readonly refunds = new MerchandiseRefundService(),
  ) {}
  publicSkus: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.publicSkus(z.string().min(1).max(80).parse(req.params.publicId)),
    );
  createProduct: RequestHandler = async (req, res) => {
    res.status(201);
    sendData(
      res,
      await this.service.createProduct(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.eventId),
        productInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
  product(admin = false): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.service.product(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          admin,
        ),
      );
  }
  products: RequestHandler = async (req, res) => {
    const q = merchandiseQuery.parse(req.query);
    sendData(
      res,
      await this.service.products(
        await authenticatedUser(req.get('authorization')),
        req.params.eventId ? numericId.parse(req.params.eventId) : undefined,
        q.status,
        q.page,
        q.pageSize,
      ),
    );
  };
  changeProduct(action: 'edit' | 'submit' | 'archive' | 'approve' | 'reject'): RequestHandler {
    return async (req, res) => {
      const q = action === 'edit' ? productUpdate.parse(req.body) : productDecision.parse(req.body);
      sendData(
        res,
        await this.service.changeProduct(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          action,
          q.version,
          'reason' in q ? q.reason : 'Edit draft',
          'product' in q ? q.product : undefined,
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
        ),
      );
    };
  }
  stock: RequestHandler = async (req, res) => {
    const q = stockInput.parse(req.body);
    sendData(
      res,
      await this.service.stock(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        q.version,
        q.stockTotal,
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
  createOrder: RequestHandler = async (req, res) => {
    res.status(201);
    sendData(
      res,
      await this.service.createOrder(
        await authenticatedUser(req.get('authorization')),
        orderInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
  order(scope: 'self' | 'organizer' | 'admin'): RequestHandler {
    return async (req, res) => {
      const q = reportScope.parse(req.query);
      sendData(
        res,
        await this.service.order(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          scope,
          q.reportId,
          String(res.locals.requestId),
        ),
      );
    };
  }
  orders: RequestHandler = async (req, res) => {
    const q = paginationSchema.parse(req.query);
    sendData(
      res,
      await this.service.orders(
        await authenticatedUser(req.get('authorization')),
        req.params.organizationId ? numericId.parse(req.params.organizationId) : undefined,
        q.page,
        q.pageSize,
      ),
    );
  };
  cancel: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.cancel(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        orderVersion.parse(req.body).version,
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  pay: RequestHandler = async (req, res) => {
    z.object({}).strict().parse(req.body);
    res.status(201);
    sendData(
      res,
      await this.payments.start(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
        true,
      ),
    );
  };
  fulfill: RequestHandler = async (req, res) =>
    sendData(
      res,
      await this.service.fulfill(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        fulfillmentInput.parse(req.body),
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  requestRefund: RequestHandler = async (req, res) => {
    res.status(201);
    sendData(
      res,
      await this.refunds.request(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        refundInput.parse(req.body).reason,
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
  listRefunds(scope: 'self' | 'organizer' | 'admin'): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.refunds.list(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          scope,
          reportScope.parse(req.query).reportId,
        ),
      );
  }
  changeRefund(
    action: 'approve' | 'reject' | 'retry' | 'result',
    scope: 'organizer' | 'admin',
  ): RequestHandler {
    return async (req, res) =>
      sendData(
        res,
        await this.refunds.change(
          await authenticatedUser(req.get('authorization')),
          numericId.parse(req.params.id),
          action,
          (action === 'result' ? refundResult : refundDecision).parse(req.body),
          scope,
          idempotencyKey.parse(req.get('idempotency-key')),
          String(res.locals.requestId),
        ),
      );
  }
  compensate: RequestHandler = async (req, res) => {
    const q = compensationInput.parse(req.body);
    res.status(201);
    sendData(
      res,
      await this.refunds.compensate(
        await authenticatedUser(req.get('authorization')),
        numericId.parse(req.params.id),
        q.reportId,
        q.reason,
        idempotencyKey.parse(req.get('idempotency-key')),
        String(res.locals.requestId),
      ),
    );
  };
}
