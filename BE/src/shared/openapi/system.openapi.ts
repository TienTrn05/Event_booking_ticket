import { errorResponse, ref, response } from './helpers.js';
import { privateOperation } from './private-operation.js';
export const systemPaths = {
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
