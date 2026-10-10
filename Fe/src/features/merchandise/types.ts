export interface HomeMerchandiseProduct {
  id: string;
  name: string;
  image: string;
  price: string;
  currency: string;
  organizer: string;
  organizerId: string;
  eventId: string;
  badge: 'New' | 'Limited' | 'Best Seller' | null;
  eventTitle: string;
  description: string;
  requiresTicket: boolean;
}
