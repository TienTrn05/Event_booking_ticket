export interface HomeMerchandiseProduct {
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
