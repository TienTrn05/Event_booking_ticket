export const json = (schema: Record<string, unknown>) => ({ 'application/json': { schema } });

export const envelope = (schema: Record<string, unknown>) => ({
  type: 'object',
  properties: { data: schema, meta: { $ref: '#/components/schemas/ResponseMeta' } },
});

export const result = (schema: Record<string, unknown>) => ({
  description: 'Kết quả theo scope User hiện tại.',
  content: json(envelope(schema)),
});

export const errors = {
  '400': { description: 'Input không hợp lệ.' },
  '401': { description: 'Phiên không hợp lệ.' },
  '403': { description: 'Origin hoặc quyền không hợp lệ.' },
  '404': { description: 'Không tìm thấy tài nguyên trong scope.' },
  '409': { description: 'Trạng thái/version không cho phép.' },
  '415': { description: 'Body phải có Content-Type application/json.' },
  '422': { description: 'Chưa đủ tuổi, thiếu thông tin hoặc giấy tờ không khớp.' },
};

export const bearer = [{ bearerAuth: [] }];

export const pathId = (name = 'id') => ({
  name,
  in: 'path',
  required: true,
  schema: { type: 'string' },
});

export const page = [
  {
    name: 'page',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
  },
  {
    name: 'pageSize',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
];

export const body = (schema: Record<string, unknown>) => ({
  required: true,
  content: json(schema),
});

export const common = { security: bearer, responses: { ...errors } };
