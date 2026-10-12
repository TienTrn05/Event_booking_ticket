import { describe, it, expect } from 'vitest';
import {
  rankRecommendations,
  type RecommendationCandidate,
} from '../src/modules/catalog/recommendations/recommendation.policy.js';
import { onboardingInput } from '../src/modules/users/onboarding/onboarding.schema.js';
const now = new Date('2026-10-11T00:00:00Z');
const event = (id: string, changes: Partial<RecommendationCandidate> = {}) => ({
  id,
  categorySlug: 'music',
  city: 'Ha Noi',
  organizerId: 'o1',
  startsAt: '2026-10-12T00:00:00Z',
  popularity: 0,
  ...changes,
});
describe('onboarding and rule recommendations', () => {
  it('requires role, display name, gender and birthday but permits skipping optional choices', () => {
    const data = {
      role: 'CUSTOMER',
      displayName: 'Fixture',
      gender: 'UNDISCLOSED',
      dateOfBirth: '1990-01-01',
    };
    expect(onboardingInput.parse(data)).toMatchObject({
      favoriteCategories: [],
      preferredCity: null,
      followedOrganizers: [],
    });
    for (const field of ['role', 'displayName', 'gender', 'dateOfBirth']) {
      const candidate = { ...data };
      Reflect.deleteProperty(candidate, field);
      expect(onboardingInput.safeParse(candidate).success).toBe(false);
    }
    expect(onboardingInput.safeParse({ ...data, role: 'ADMIN' }).success).toBe(false);
  });
  it('prefers interests, city and follows while inserting popular discovery', () => {
    const list = [
      event('a'),
      event('b'),
      event('c'),
      event('d'),
      event('discovery', {
        categorySlug: 'sports',
        city: 'Da Nang',
        organizerId: 'o2',
        popularity: 10000,
      }),
    ];
    const result = rankRecommendations(
      list,
      { categories: ['music'], city: 'Ha Noi', organizers: ['o1'] },
      now,
    );
    expect(result[0]?.event.id).toBe('a');
    expect(result[3]?.event.id).toBe('discovery');
    expect(result[0]?.reasons).toContain('FOLLOWING');
    expect(new Set(result.map((r) => r.event.id)).size).toBe(result.length);
  });
  it('excludes past events and provides deterministic fallback without preferences', () => {
    const list = [
      event('past', { startsAt: '2026-10-10T00:00:00Z' }),
      event('soon'),
      event('later', { startsAt: '2026-12-20T00:00:00Z' }),
    ];
    expect(
      rankRecommendations(list, { categories: [], city: null, organizers: [] }, now).map(
        (r) => r.event.id,
      ),
    ).toEqual(['soon', 'later']);
  });
});
