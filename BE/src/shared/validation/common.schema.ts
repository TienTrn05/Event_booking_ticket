import { z } from 'zod';

/** PostgreSQL BIGINT IDs stay strings throughout the API. */
export const numericId = z
  .string()
  .regex(/^[1-9][0-9]{0,18}$/)
  .pipe(z.string().refine((value) => BigInt(value) <= 9223372036854775807n));

export const publicId = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
export const versionSchema = z.number().int().min(0).max(2147483647);
export const emptyBodySchema = z.object({}).strict();

// Query parameters must be scalar decimal strings; arrays/objects must not be coerced.
export const queryInteger = (maximum: number) =>
  z
    .string()
    .regex(/^[0-9]+$/)
    .max(16)
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximum));
export const paginationShape = {
  page: queryInteger(100000).default(1),
  pageSize: queryInteger(100).default(20),
};
export const paginationSchema = z.object(paginationShape).strict();
export type PageInput = z.infer<typeof paginationSchema>;

export const calendarDate = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      value >= '0001-01-01' &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, 'Invalid calendar date');
