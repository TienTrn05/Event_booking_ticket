import { getEventById } from '../../events/data/eventCatalog';
import { organizers } from '../../organizer/data/organizers';
import { demoProducts, type MerchandiseProduct } from './catalog';
import { merchandise } from './homeMerchandise';

export interface MerchandiseRecord {
  id: string;
  eventId: string;
  eventTitle: string;
  name: string;
  image?: string;
  priceVnd: number;
  currency: string;
  organizer: string;
  organizerId?: string;
  badge?: string | null;
  requiresTicket: boolean;
  artwork?: MerchandiseProduct;
}

const homeProducts: MerchandiseRecord[] = merchandise.map((product) => ({
  id: product.id,
  eventId: product.eventId,
  eventTitle: product.eventTitle,
  name: product.name,
  image: product.image,
  priceVnd: product.price,
  currency: product.currency,
  organizer: product.organizer,
  organizerId: product.organizerId,
  badge: product.badge,
  requiresTicket: false,
}));

const legacyProducts: MerchandiseRecord[] = demoProducts.map((product) => {
  const event = getEventById(product.eventId);
  const organizer = organizers.find((item) => item.name === event?.organizer);
  return {
    id: product.id,
    eventId: product.eventId,
    eventTitle: product.eventTitle,
    name: product.name,
    priceVnd: product.priceVnd,
    currency: 'VND',
    organizer: event?.organizer ?? product.displayName,
    ...(organizer ? { organizerId: organizer.id } : {}),
    requiresTicket: product.requiresTicket,
    artwork: product,
  };
});

export const merchandiseCatalog: MerchandiseRecord[] = [...homeProducts, ...legacyProducts];

export function getMerchandiseById(id: string | undefined) {
  return merchandiseCatalog.find((product) => product.id === id);
}
