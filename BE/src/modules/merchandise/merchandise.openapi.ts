import { z } from 'zod';
import { privateOperation as op } from '../../shared/openapi/private-operation.js';
import {
  productInput,
  productUpdate,
  productDecision,
  stockInput,
  orderInput,
  fulfillmentInput,
} from './merchandise.schema.js';
import { orderVersion, compensationInput } from './merchandise.controller.js';
import { refundInput, refundDecision, refundResult } from '../refunds/refund.schema.js';
const operation = (
  path: string,
  method: 'get' | 'post' | 'patch',
  summary: string,
  body?: z.ZodType,
  queries: string[] = [],
) => op(path, method, 'Merchandise', summary, body, queries);
export const merchandisePaths = {
  '/organizer/organizations/{organizationId}/merchandise-sales': {
    get: operation(
      '/organizer/organizations/{organizationId}/merchandise-sales',
      'get',
      'Merchandise order cohort totals, money separated from ticket sales.',
      undefined,
      ['from', 'to'],
    ),
  },
  '/merchandise/{publicId}/skus': {
    get: {
      ...operation(
        '/merchandise/{publicId}/skus',
        'get',
        'Public SKU IDs, VND prices, available stock and fixed shipping fee.',
      ),
      security: [],
      parameters: [{ name: 'publicId', in: 'path', required: true, schema: { type: 'string' } }],
    },
  },
  '/organizer/events/{eventId}/merchandise': {
    get: operation(
      '/organizer/events/{eventId}/merchandise',
      'get',
      'Scoped products.',
      undefined,
      ['page', 'pageSize', 'status'],
    ),
    post: operation(
      '/organizer/events/{eventId}/merchandise',
      'post',
      'Create draft product and SKUs; upload image through existing R2 media receipt.',
      productInput,
    ),
  },
  '/organizer/merchandise/{id}': {
    get: operation('/organizer/merchandise/{id}', 'get', 'Scoped product and SKU versions.'),
    patch: operation(
      '/organizer/merchandise/{id}',
      'patch',
      'Edit draft/rejected product.',
      productUpdate,
    ),
  },
  '/admin/merchandise': {
    get: operation('/admin/merchandise', 'get', 'Products for review.', undefined, [
      'page',
      'pageSize',
      'status',
    ]),
  },
  '/admin/merchandise/{id}': {
    get: operation('/admin/merchandise/{id}', 'get', 'Admin product review.'),
  },
  ...Object.fromEntries(
    (['submit', 'archive', 'approve', 'reject'] as const).map((a) => {
      const p = `/${a === 'approve' || a === 'reject' ? 'admin' : 'organizer'}/merchandise/{id}/${a}`;
      return [p, { post: operation(p, 'post', 'Versioned product ' + a + '.', productDecision) }];
    }),
  ),
  '/organizer/merchandise-skus/{id}/stock': {
    post: operation(
      '/organizer/merchandise-skus/{id}/stock',
      'post',
      'Add stock; never remove committed inventory.',
      stockInput,
    ),
  },
  '/merchandise-orders': {
    post: operation(
      '/merchandise-orders',
      'post',
      'Reserve up to 20 units in one event for 5 minutes. Vietnam only; shipping is the highest fixed product fee in this order.',
      orderInput,
    ),
  },
  '/merchandise-orders/{id}/cancel': {
    post: operation(
      '/merchandise-orders/{id}/cancel',
      'post',
      'Cancel unpaid own order.',
      orderVersion,
    ),
  },
  '/merchandise-orders/{id}/payments': {
    post: operation(
      '/merchandise-orders/{id}/payments',
      'post',
      'Start existing payOS lifecycle for merchandise; no tickets issued.',
      z.object({}).strict(),
    ),
  },
  '/users/me/merchandise-orders': {
    get: operation('/users/me/merchandise-orders', 'get', 'Own order history.', undefined, [
      'page',
      'pageSize',
    ]),
  },
  '/organizer/organizations/{organizationId}/merchandise-orders': {
    get: operation(
      '/organizer/organizations/{organizationId}/merchandise-orders',
      'get',
      'Scoped fulfillment orders.',
      undefined,
      ['page', 'pageSize'],
    ),
  },
  '/organizer/merchandise-orders/{id}/fulfillment': {
    post: operation(
      '/organizer/merchandise-orders/{id}/fulfillment',
      'post',
      'Manual shipping with tracking and evidence. Active refund blocks shipping.',
      fulfillmentInput,
    ),
  },
  ...Object.fromEntries(
    (['self', 'organizer', 'admin'] as const).map((s) => {
      const p = `/${s === 'self' ? 'users/me' : s}/merchandise-orders/{id}`;
      return [
        p,
        {
          get: operation(
            p,
            'get',
            'Order details; Admin requires assigned open report and receives no address.',
            undefined,
            s === 'admin' ? ['reportId'] : [],
          ),
        },
      ];
    }),
  ),
  '/merchandise-orders/{id}/refunds': {
    post: operation(
      '/merchandise-orders/{id}/refunds',
      'post',
      'Request full refund before shipping.',
      refundInput,
    ),
  },
  ...Object.fromEntries(
    (['self', 'organizer', 'admin'] as const).map((s) => {
      const p = `/${s === 'self' ? 'users/me' : s}/merchandise-orders/{id}/refunds`;
      return [
        p,
        {
          get: operation(
            p,
            'get',
            'Order refund history within scope.',
            undefined,
            s === 'admin' ? ['reportId'] : [],
          ),
        },
      ];
    }),
  ),
  ...Object.fromEntries(
    (['organizer', 'admin'] as const).flatMap((s) =>
      (['approve', 'reject', 'retry', 'result'] as const).map((a) => {
        const p = `/${s}/merchandise-refunds/{id}/${a}`;
        return [
          p,
          {
            post: operation(
              p,
              'post',
              'Manual full refund ' +
                a +
                '; exact report required for Admin. SUCCESS requires unique transfer evidence.',
              a === 'result' ? refundResult : refundDecision,
            ),
          },
        ];
      }),
    ),
  ),
  '/admin/merchandise-payments/{id}/refunds': {
    post: operation(
      '/admin/merchandise-payments/{id}/refunds',
      'post',
      'Refund all received money for an exception using its assigned order report; no provider transfer is simulated.',
      compensationInput,
    ),
  },
};
