import { demoEvents, type DiscoveryEvent } from './discovery';
import { exploreEvents, officialEvents } from './mockData';

export interface EventRecord {
  id: string;
  title: string;
  category: string;
  image?: string;
  dateLabel: string;
  startsAt: string;
  venue: string;
  city: string;
  priceVnd?: number;
  organizer: string;
  organizerId?: string;
  description: string;
  admission: 'numbered' | 'quantity';
  status?: string;
  artwork?: DiscoveryEvent;
  reopening?: string;
}

const homeEvents: EventRecord[] = exploreEvents.map((event) => ({
  id: event.id,
  title: event.title,
  category: event.category,
  image: event.image,
  dateLabel: event.dateLabel,
  startsAt: `${event.date}T19:00:00+07:00`,
  venue: event.venue,
  city: event.city,
  priceVnd: event.startingPrice,
  organizer: event.organizer,
  ...(event.organizerId ? { organizerId: event.organizerId } : {}),
  description: `Trải nghiệm ${event.category.toLocaleLowerCase('vi')} do ${event.organizer} tổ chức tại ${event.venue}.`,
  admission: 'quantity',
  status: event.status,
}));

const legacyEvents: EventRecord[] = demoEvents.map((event) => ({
  id: event.id,
  title: event.title,
  category: event.category,
  ...(event.image ? { image: event.image } : {}),
  dateLabel: new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(event.startsAt)),
  startsAt: event.startsAt,
  venue: event.venue,
  city: event.city,
  priceVnd: event.priceVnd,
  organizer: event.organization,
  description: event.description,
  admission: event.admission,
  artwork: event,
  ...(event.reopening ? { reopening: event.reopening } : {}),
}));

const partnerEvents: EventRecord[] = officialEvents.map((event) => ({
  id: event.id,
  title: event.title,
  category: event.category,
  image: event.image,
  dateLabel: event.dateLabel,
  startsAt: `${event.date}T09:00:00+07:00`,
  venue: event.venue,
  city: event.venue.split(',').at(-1)?.trim() ?? event.venue,
  organizer: event.organizer,
  description: `${event.badge} do ${event.organizer} công bố trong khu vực Spotlight.`,
  admission: 'quantity',
  status: event.badge,
}));

export const eventCatalog: EventRecord[] = [...homeEvents, ...legacyEvents, ...partnerEvents];

export function getEventById(id: string | undefined) {
  return eventCatalog.find((event) => event.id === id);
}
