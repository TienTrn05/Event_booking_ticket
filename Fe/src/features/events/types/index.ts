export type EventCategory = 'Music' | 'Technology' | 'Sports' | 'Arts' | 'Workshops' | 'Festivals';

export interface Event {
  id: string;
  title: string;
  category: EventCategory;
  image: string;
  date: string;
  dateLabel: string;
  venue: string;
  city: string;
  startingPrice: number;
  currency: string;
  organizer: string;
  organizerId?: string;
  status: 'on-sale' | 'few-left' | 'sold-out' | 'coming-soon';
  featured?: boolean;
  hotBadge?: string;
}

export interface Category {
  name: EventCategory;
  icon: string;
  eventCount: number;
  gradient: string;
}

export interface ResaleTicket {
  id: string;
  eventTitle: string;
  image: string;
  date: string;
  dateLabel: string;
  venue: string;
  city: string;
  seatInfo: string;
  resalePrice: number;
  originalPrice: number;
  currency: string;
  sellerVerified: boolean;
  timeLeft: string;
}

export interface OfficialEvent {
  id: string;
  title: string;
  image: string;
  date: string;
  dateLabel: string;
  venue: string;
  organizer: string;
  category: string;
  badge: string;
}
