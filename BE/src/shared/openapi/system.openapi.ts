import { errorResponse, ref, response } from './helpers.js';
import { privateOperation } from './private-operation.js';
export const systemPaths = {
  '/admin/statistics': {
    get: privateOperation(
      '/admin/statistics',
      'get',
      'Admin',
      'ADMIN + statistics.read_system. Tổng hợp tài khoản/tổ chức/sự kiện theo ngày tạo [from,to); đơn/vé/tiền theo ngày tạo booking. Tiền là chuỗi minor, tách tiền nhận/hoàn/đối soát; không PII.',
      undefined,
      ['from', 'to'],
    ),
  },
  '/admin/operations/health': {
    get: privateOperation(
      '/admin/operations/health',
      'get',
      'Admin',
      'Trạng thái worker/schema/runtime và số backlog; statistics.read_system, không credential/PII.',
    ),
  },
  '/health/live': {
    get: {
      tags: ['Health'],
      operationId: 'getLiveness',
      summary: 'Kiểm tra process API',
      responses: { '200': response('API đang chạy.', ref('HealthStatus')) },
    },
  },
  '/health/ready': {
    get: {
      tags: ['Health'],
      operationId: 'getReadiness',
      summary: 'Kiểm tra schema nghiệp vụ, Redis đã cấu hình và worker khi bật yêu cầu readiness.',
      responses: {
        '200': response('API và database sẵn sàng.', ref('ReadyStatus')),
        '503': errorResponse(
          'Schema/runtime/worker cần thiết chưa sẵn sàng; không trả thông tin nội bộ.',
        ),
      },
    },
  },
};
