import { z } from 'zod';
export const idempotencyHeader = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  schema: { type: 'string', minLength: 8, maxLength: 191 },
};
export function inputSchema(schema: z.ZodType) {
  return z.toJSONSchema(schema, { io: 'input', target: 'openapi-3.0', unrepresentable: 'any' });
}
