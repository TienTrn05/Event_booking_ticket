import { describe, it, expect } from 'vitest';
import { zoneLayoutInput } from '../src/modules/events/management/event-management.schema.js';
import { validateZoneLayout } from '../src/modules/events/management/layout.policy.js';
import { zoneHoldInput } from '../src/modules/bookings/holds/hold.schema.js';
describe('outdoor boundaries', () => {
  it('rejects duplicate zones, overlap, excess capacity and over-six ticket requests', () => {
    const data = zoneLayoutInput.parse({
      version: 0,
      venueId: '1',
      zones: [{ code: 'GA', name: 'General', capacity: 3, x: 0, y: 0, width: 5, height: 5 }],
    });
    expect(() => validateZoneLayout(data, 10, 10, 2)).toThrow();
    expect(() =>
      validateZoneLayout({ ...data, zones: [...data.zones, ...data.zones] }, 10, 10, 20),
    ).toThrow();
    expect(() =>
      validateZoneLayout({ ...data, stage: { x: 0, y: 0, width: 1, height: 1 } }, 10, 10, 20),
    ).toThrow();
    expect(
      zoneHoldInput.safeParse({
        zones: [
          { sectionId: '1', quantity: 4 },
          { sectionId: '2', quantity: 3 },
        ],
      }).success,
    ).toBe(false);
  });
});
