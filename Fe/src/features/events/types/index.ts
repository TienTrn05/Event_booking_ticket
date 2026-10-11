export type EventCategory = string;

export interface Event {
  id: string;
  title: string;
  minimumAge: number | null;
  ageTag: string | null;
  category: EventCategory;
  image: string;
  date: string;
  dateLabel: string;
  venue: string;
  city: string;
  startingPrice: string;
  currency: string;
  organizer: string;
  organizerId?: string;
  status: 'on-sale' | 'few-left' | 'sold-out' | 'coming-soon';
  featured?: boolean;
  hotBadge?: string;
  displayName: string;
  categorySlug: string;
  startsAt: string;
  description: string;
  admission: 'numbered' | 'quantity';
  badge: string | null;
  spotlight: boolean;
  reopeningNote: string | null;
}

export interface Category {
  name: EventCategory;
  icon: string;
  eventCount: number;
  gradient: string;
}

export interface ReopeningRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  image: string;
  organizer: string;
  type: string;
  reason: string;
  impactSummary: string;
  status: string;
  requestedAt: string;
}
