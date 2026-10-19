import type { ZodType } from 'zod';

/** Invalid cache data is a miss; callers reload from the authoritative database. */
export function parseCachedJson<T>(schema: ZodType<T>, value: unknown): T | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = schema.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}
