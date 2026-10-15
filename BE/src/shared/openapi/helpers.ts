type Schema = Record<string, unknown>;

export const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });

export const arrayOf = (name: string): Schema => ({ type: 'array', items: ref(name) });

const envelope = (data: Schema): Schema => ({
  type: 'object',
  required: ['data', 'meta'],
  properties: {
    data,
    meta: ref('ResponseMeta'),
  },
});

export const response = (description: string, data: Schema) => ({
  description,
  content: { 'application/json': { schema: envelope(data) } },
});

export const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ref('ErrorEnvelope') } },
});

export const idParameter = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', minLength: 1, maxLength: 160, pattern: '^[a-zA-Z0-9-]+$' },
});
