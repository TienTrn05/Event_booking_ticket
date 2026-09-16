export type EventCategory =
  | 'Music'
  | 'Technology'
  | 'Sports'
  | 'Arts'
  | 'Workshops'
  | 'Festivals';

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

export interface Organizer {
  id: string;
  name: string;
  avatar: string;
  verified: boolean;
  eventCount: number;
  hasMerchandise: boolean;
  category: string;
  upcomingEventTitle?: string;
  upcomingEventDate?: string;
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

export interface MerchandiseProduct {
  id: string;
  name: string;
  image: string;
  price: number;
  currency: string;
  organizer: string;
  organizerId: string;
  badge: 'New' | 'Limited' | 'Best Seller' | null;
  eventTitle: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  date: string;
  category: string;
  readTime: string;
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
