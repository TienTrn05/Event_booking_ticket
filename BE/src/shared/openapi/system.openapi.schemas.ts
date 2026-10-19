import { ref } from './helpers.js';
export const systemSchemas = {
  ResponseMeta: {
    type: 'object',
    required: ['requestId'],
    properties: { requestId: { type: 'string', format: 'uuid' } },
  },
  ErrorEnvelope: {
    type: 'object',
    required: ['error', 'meta'],
    properties: {
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: {
            type: 'array',
            items: {
              type: 'object',
              required: ['field', 'code'],
              properties: { field: { type: 'string' }, code: { type: 'string' } },
            },
          },
        },
      },
      meta: ref('ResponseMeta'),
    },
  },
  HealthStatus: {
    type: 'object',
    required: ['status'],
    properties: { status: { type: 'string', enum: ['ok'] } },
  },
  ReadyStatus: {
    type: 'object',
    required: ['status'],
    properties: { status: { type: 'string', enum: ['ready'] } },
  },
};
