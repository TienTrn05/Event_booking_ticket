export type RecommendationCandidate = {
  id: string;
  categorySlug: string;
  organizerId: string;
  city: string;
  startsAt: string;
  popularity: number;
};
export type RecommendationPreferences = {
  categories: string[];
  city: string | null;
  organizers: string[];
};
export function rankRecommendations<T extends RecommendationCandidate>(
  events: T[],
  preferences: RecommendationPreferences,
  now: Date,
  limit = 12,
) {
  const upcoming = events.filter(
    (e) => Number.isFinite(Date.parse(e.startsAt)) && Date.parse(e.startsAt) > now.getTime(),
  );
  const ranked = upcoming
    .map((event) => {
      const reasons: string[] = [];
      let score = 0;
      if (preferences.organizers.includes(event.organizerId)) {
        score += 40;
        reasons.push('FOLLOWING');
      }
      if (preferences.categories.includes(event.categorySlug)) {
        score += 30;
        reasons.push('CATEGORY');
      }
      if (preferences.city === event.city) {
        score += 20;
        reasons.push('CITY');
      }
      const days = Math.floor((Date.parse(event.startsAt) - now.getTime()) / 86400000);
      score += Math.max(0, 20 - days);
      if (days < 7) reasons.push('SOON');
      const popularity = Math.max(0, Math.min(10, Math.floor(Math.log2(1 + event.popularity) * 2)));
      score += popularity;
      if (event.popularity > 0) reasons.push('POPULAR');
      return { event, score, reasons };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) ||
        a.event.id.localeCompare(b.event.id),
    );
  const discovery = [...ranked].sort(
    (a, b) =>
      b.event.popularity - a.event.popularity ||
      Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) ||
      a.event.id.localeCompare(b.event.id),
  );
  const selected: typeof ranked = [],
    used = new Set<string>();
  while (selected.length < Math.min(limit, ranked.length)) {
    const pool = selected.length % 4 === 3 ? discovery : ranked;
    const next = pool.find((r) => !used.has(r.event.id));
    if (!next) break;
    selected.push(next);
    used.add(next.event.id);
  }
  return selected;
}
