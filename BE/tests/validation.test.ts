import { describe, expect, it } from 'vitest';
import { holdInput } from '../src/modules/bookings/holds/hold.schema.js';
import { bookingInput } from '../src/modules/bookings/orders/booking.schema.js';
import { marketCacheSchema } from '../src/modules/bookings/waiting-room/waiting-room.schema.js';
import { eventQuery, organizerQuery } from '../src/modules/catalog/schemas/catalog.schema.js';
import { ageRestrictionInput } from '../src/modules/events/age/age.schema.js';
import { uploadSchema } from '../src/modules/media/schemas/media.schema.js';
import { updateProfileSchema } from '../src/modules/users/schemas/users.schema.js';
import { parseCachedJson } from '../src/shared/validation/cached-json.js';
import {
  calendarDate,
  emptyBodySchema,
  numericId,
  paginationSchema,
  versionSchema,
} from '../src/shared/validation/common.schema.js';
import { normalizeEmail, normalizePhone } from '../src/shared/validation/contact.schema.js';

describe('API validation boundaries', () => {
  it.each([
    'abc',
    '1.5',
    '-1',
    '0',
    '01',
    '9223372036854775808',
    '999999999999999999999',
    '',
    '1e2',
  ])('rejects invalid bigint ID %s with a validation error', (id) => {
    expect(() => numericId.parse(id)).toThrowError(expect.objectContaining({ name: 'ZodError' }));
  });
  it('preserves bigint precision', () => {
    expect(numericId.parse('9223372036854775807')).toBe('9223372036854775807');
  });
  it.each([
    { page: ['1'] },
    { page: {} },
    { page: true },
    { page: '1.5' },
    { page: '1e2' },
    { page: '100001' },
    { pageSize: '101' },
    { page: '' },
  ])('rejects malformed or unbounded pagination %j', (input) => {
    expect(paginationSchema.safeParse(input).success).toBe(false);
  });
  it('keeps endpoint-specific pagination defaults', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(eventQuery.parse({})).toEqual({ page: 1, pageSize: 24 });
    expect(eventQuery.parse({ page: '2', pageSize: '100' }).page).toBe(2);
  });
  it.each(['yes', '1', ['true'], { value: 'true' }])(
    'rejects invalid organizer boolean %j',
    (featured) => {
      expect(organizerQuery.safeParse({ featured }).success).toBe(false);
    },
  );
  it('parses false without JavaScript truthiness', () => {
    expect(organizerQuery.parse({ featured: 'false' })).toEqual({ featured: false });
  });
  it.each(['2025-02-29', '2024-02-30', '0000-01-01', '2024-2-01'])(
    'rejects nonexistent calendar date %s',
    (date) => {
      expect(calendarDate.safeParse(date).success).toBe(false);
    },
  );
  it('accepts leap dates and preserves Unicode names', () => {
    expect(calendarDate.parse('2024-02-29')).toBe('2024-02-29');
    expect(updateProfileSchema.parse({ displayName: '  Nguyễn An  ' })).toEqual({
      displayName: 'Nguyễn An',
    });
  });
  it('rejects mass assignment and empty updates', () => {
    expect(updateProfileSchema.safeParse({ displayName: 'An', role: 'ADMIN' }).success).toBe(false);
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
  it('rejects duplicate seats and mismatched duplicate attendee IDs', () => {
    expect(holdInput.safeParse({ seatIds: ['1', '1'] }).success).toBe(false);
    expect(
      bookingInput.safeParse({
        holdId: '1',
        attendees: [
          { sessionSeatId: '2', attendeeName: 'An' },
          { sessionSeatId: '2', attendeeName: 'Bình' },
        ],
      }).success,
    ).toBe(false);
  });
  it('bounds versions to the database INTEGER range', () => {
    expect(versionSchema.safeParse(2147483648).success).toBe(false);
    expect(versionSchema.safeParse(Number.MAX_SAFE_INTEGER).success).toBe(false);
    expect(ageRestrictionInput.safeParse({ minimumAge: 18, version: 2147483648 }).success).toBe(
      false,
    );
    expect(
      uploadSchema.safeParse({
        purpose: 'event',
        targetId: '1',
        contentType: 'image/png',
        size: 12,
        version: 2147483648,
      }).success,
    ).toBe(false);
  });
  it.each([[], 'configuration', 1, { capacity: 100 }])(
    'rejects nonempty or nonobject waiting-room body %j',
    (body) => {
      expect(emptyBodySchema.safeParse(body).success).toBe(false);
    },
  );
  it('treats malformed/untrusted cache entries as misses', () => {
    expect(parseCachedJson(marketCacheSchema, '{')).toBeUndefined();
    expect(
      parseCachedJson(marketCacheSchema, JSON.stringify({ publicId: 'fe1', state: 'BYPASS' })),
    ).toBeUndefined();
    expect(
      parseCachedJson(
        marketCacheSchema,
        JSON.stringify({ publicId: 'fe1', state: 'OPEN', owner: 'private' }),
      ),
    ).toBeUndefined();
    expect(
      parseCachedJson(marketCacheSchema, JSON.stringify({ publicId: 'fe1', state: 'OPEN' })),
    ).toEqual({ publicId: 'fe1', state: 'OPEN' });
  });
  it('keeps established contact normalization', () => {
    expect(normalizePhone('090 123 4567')).toBe('+84901234567');
    expect(normalizeEmail(' Person.Name+tag@GMAIL.COM ')).toBe('person.name+tag@gmail.com');
  });
});
