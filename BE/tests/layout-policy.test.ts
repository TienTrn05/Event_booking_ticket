import { describe, it, expect } from 'vitest';
import { layoutInput } from '../src/modules/events/management/event-management.schema.js';
import { validateLayout } from '../src/modules/events/management/layout.policy.js';
const seat = { section: 'Main', row: 'A', number: '1', x: 1, y: 1, width: 1, height: 1 };
const input = (seats = [seat]) => layoutInput.parse({ version: 0, venueId: '1', seats });
describe('physical venue bounds', () => {
  it('rejects seats outside venue or capacity', () => {
    expect(() => validateLayout(input([{ ...seat, x: 10 }]), 10, 10, 100)).toThrow();
    expect(() => validateLayout(input(), 10, 10, 0)).toThrow();
  });
  it('rejects duplicate labels, overlap and blocked areas', () => {
    expect(() => validateLayout(input([seat, { ...seat, x: 3 }]), 10, 10, 100)).toThrow();
    expect(() =>
      validateLayout(input([seat, { ...seat, number: '2', x: 1.5 }]), 10, 10, 100),
    ).toThrow();
    const value = input();
    value.blocked = [{ x: 0, y: 0, width: 3, height: 3 }];
    expect(() => validateLayout(value, 10, 10, 100)).toThrow();
  });
  it('accepts distinct non-overlapping seats beside a stage', () => {
    const value = input([seat, { ...seat, number: '2', x: 3 }]);
    value.stage = { x: 0, y: 5, width: 5, height: 2 };
    expect(() => validateLayout(value, 10, 10, 100)).not.toThrow();
  });
});
