import { privateOperation as op } from '../../shared/openapi/private-operation.js';
const root = '/organizer/organizations/{organizationId}';
const list = ['eventId', 'sessionId', 'status', 'from', 'to', 'page', 'pageSize'];
export const salesPaths = {
  [root + '/orders']: {
    get: op(
      root + '/orders',
      'get',
      'Organizer sales',
      'Đơn trong tổ chức, from/to theo thời điểm tạo đơn [from,to).',
      undefined,
      list,
    ),
  },
  '/organizer/orders/{id}': {
    get: op(
      '/organizer/orders/{id}',
      'get',
      'Organizer sales',
      'Chi tiết đơn/item/payment; không trả CCCD, QR, token hoặc checkout URL.',
    ),
  },
  [root + '/tickets']: {
    get: op(
      root + '/tickets',
      'get',
      'Organizer sales',
      'Danh sách vé trong tổ chức; không trả credential vé.',
      undefined,
      list,
    ),
  },
  [root + '/sales-summary']: {
    get: op(
      root + '/sales-summary',
      'get',
      'Organizer sales',
      'Thống kê cohort đơn theo ngày tạo; gross sales khác tiền thực nhận, trừ hoàn SUCCESS để ra netReceived.',
      undefined,
      ['eventId', 'sessionId', 'from', 'to'],
    ),
  },
  [root + '/reconciliation']: {
    get: op(
      root + '/reconciliation',
      'get',
      'Organizer sales',
      'Danh sách payment cần đối soát trong tổ chức; mặc định REQUIRED.',
      undefined,
      list,
    ),
  },
};
