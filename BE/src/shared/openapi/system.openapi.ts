import { errorResponse, ref, response } from './helpers.js';
export const systemPaths = {
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
      summary: 'Kiểm tra kết nối và schema catalog',
      responses: {
        '200': response('API và database sẵn sàng.', ref('ReadyStatus')),
        '503': errorResponse('Database chưa sẵn sàng hoặc thiếu migration catalog.'),
      },
    },
  },
};
