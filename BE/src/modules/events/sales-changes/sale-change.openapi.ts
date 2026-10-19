import { privateOperation as op } from '../../../shared/openapi/private-operation.js';
import { saleChangeInput } from './sale-change.schema.js';
import { saleDecision } from './sale-change.controller.js';
export const saleChangePaths = {
  '/organizer/events/{eventId}/sale-changes': {
    get: op(
      '/organizer/events/{eventId}/sale-changes',
      'get',
      'Organizer',
      'Requests for this event.',
      undefined,
      ['page', 'pageSize'],
    ),
    post: op(
      '/organizer/events/{eventId}/sale-changes',
      'post',
      'Organizer',
      'Request an additional sale window or append inventory; no existing ticket changes.',
      saleChangeInput,
    ),
  },
  '/admin/sale-changes': {
    get: op(
      '/admin/sale-changes',
      'get',
      'Admin',
      'Review pending and historical sale changes.',
      undefined,
      ['page', 'pageSize'],
    ),
  },
  ...Object.fromEntries(
    (['approve', 'reject', 'withdraw'] as const).map((a) => {
      const path = `/${a === 'withdraw' ? 'organizer' : 'admin'}/sale-changes/{id}/${a}`;
      return [
        path,
        {
          post: op(
            path,
            'post',
            a === 'withdraw' ? 'Organizer' : 'Admin',
            'Versioned sale change decision.',
            saleDecision,
          ),
        },
      ];
    }),
  ),
};
