import type { z } from 'zod';
import { inputSchema, idempotencyHeader } from './input-schema.js';
export function privateOperation(
  path: string,
  method: 'get' | 'post' | 'patch' | 'put' | 'delete',
  tag: string,
  summary: string,
  body?: z.ZodType,
  queries: string[] = [],
) {
  const parameters: Array<Record<string, unknown>> = [...path.matchAll(/\{([^}]+)\}/g)].map(
    (m) => ({
      name: m[1],
      in: 'path',
      required: true,
      schema: { type: 'string', pattern: '^[1-9][0-9]*$' },
    }),
  );
  if (method !== 'get')
    parameters.push(idempotencyHeader, {
      name: 'Origin',
      in: 'header',
      required: true,
      schema: { type: 'string' },
      description: 'Origin website đã cấu hình; browser tự gửi.',
    });
  for (const name of queries)
    parameters.push({
      name,
      in: 'query',
      required: false,
      schema:
        name === 'page' || name === 'pageSize'
          ? { type: 'integer', minimum: 1, maximum: name === 'pageSize' ? 100 : 100000 }
          : { type: 'string' },
    });
  return {
    tags: [tag],
    summary,
    security: [{ bearerAuth: [] }],
    parameters,
    ...(body
      ? {
          requestBody: {
            required: true,
            content: { 'application/json': { schema: inputSchema(body) } },
          },
        }
      : {}),
    responses: {
      '200': { description: 'Dữ liệu trong phạm vi quyền của tài khoản; response {data,meta}.' },
      ...(method === 'post' ? { '201': { description: 'Đã tạo yêu cầu.' } } : {}),
      '400': { description: 'Input không hợp lệ.' },
      '401': { description: 'Cần phiên hợp lệ.' },
      '403': { description: 'Không có quyền hoặc Origin không hợp lệ.' },
      '404': { description: 'Không tồn tại hoặc ngoài phạm vi.' },
      '409': { description: 'Version/trạng thái/hạn hoặc key xung đột.' },
      '422': { description: 'Chưa đủ điều kiện nghiệp vụ.' },
    },
  };
}
