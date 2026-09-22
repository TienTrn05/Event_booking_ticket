export interface MerchandiseProduct {
  id: string;
  eventId: string;
  displayName: string;
  eventTitle: string;
  name: string;
  priceVnd: number;
  requiresTicket: boolean;
  visual: 'tote' | 'shirt' | 'print' | 'kit';
}

export const demoProducts: MerchandiseProduct[] = [
  {
    id: 'pmc-tote',
    eventId: 'pmc',
    displayName: 'PMC',
    eventTitle: 'Fanmeeting PMC · Những điều muốn nói',
    name: 'Túi vải PMC · With you',
    priceVnd: 180000,
    requiresTicket: false,
    visual: 'tote',
  },
  {
    id: 'pmc-shirt',
    eventId: 'pmc',
    displayName: 'PMC',
    eventTitle: 'Fanmeeting PMC · Những điều muốn nói',
    name: 'Áo PMC · Fanmeeting edition',
    priceVnd: 320000,
    requiresTicket: true,
    visual: 'shirt',
  },
  {
    id: 'ocean-print',
    eventId: 'ocean-sessions',
    displayName: 'OCEAN SESSIONS',
    eventTitle: 'Ocean Sessions · Chạm vào thanh âm',
    name: 'Art print · Ocean Sessions',
    priceVnd: 150000,
    requiresTicket: false,
    visual: 'print',
  },
  {
    id: 'clay-kit',
    eventId: 'clay',
    displayName: 'CHẠM STUDIO',
    eventTitle: 'Một ngày làm gốm · Workshop sáng tạo',
    name: 'Bộ dụng cụ tạo hình · Chạm',
    priceVnd: 250000,
    requiresTicket: false,
    visual: 'kit',
  },
];
