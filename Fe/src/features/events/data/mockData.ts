import type {
  Category,
  Event,
  Organizer,
  ResaleTicket,
  MerchandiseProduct,
  BlogPost,
  OfficialEvent,
} from '../types/index';

export const categories: Category[] = [
  { name: 'Music', icon: 'Music', eventCount: 1240, gradient: 'from-primary-500 to-primary-700' },
  { name: 'Technology', icon: 'Cpu', eventCount: 860, gradient: 'from-sky-500 to-primary-700' },
  { name: 'Sports', icon: 'Trophy', eventCount: 540, gradient: 'from-cyan-500 to-primary-700' },
  { name: 'Arts', icon: 'Palette', eventCount: 720, gradient: 'from-primary-400 to-primary-700' },
  { name: 'Workshops', icon: 'Lightbulb', eventCount: 380, gradient: 'from-sky-600 to-cyan-700' },
  {
    name: 'Festivals',
    icon: 'PartyPopper',
    eventCount: 290,
    gradient: 'from-primary-500 to-sky-700',
  },
];

export const organizers: Organizer[] = [
  {
    id: 'o1',
    name: 'Sơn Tùng M-TP',
    avatar:
      'https://images.pexels.com/photos/12216243/pexels-photo-12216243.jpeg?auto=compress&cs=tinysrgb&h=200&w=200',
    verified: true,
    eventCount: 12,
    hasMerchandise: true,
    category: 'Music',
    upcomingEventTitle: 'Sơn Tùng M-TP Live Concert 2026',
    upcomingEventDate: 'Oct 18, 2026',
  },
  {
    id: 'o2',
    name: 'Đen Vâu',
    avatar:
      'https://images.pexels.com/photos/6201175/pexels-photo-6201175.jpeg?auto=compress&cs=tinysrgb&h=200&w=200',
    verified: true,
    eventCount: 8,
    hasMerchandise: true,
    category: 'Music',
    upcomingEventTitle: 'Đen Vâu Live Concert',
    upcomingEventDate: 'Oct 25, 2026',
  },
  {
    id: 'o3',
    name: 'Monsoon Festival',
    avatar:
      'https://images.pexels.com/photos/17373843/pexels-photo-17373843.jpeg?auto=compress&cs=tinysrgb&h=200&w=200',
    verified: true,
    eventCount: 5,
    hasMerchandise: true,
    category: 'Festivals',
    upcomingEventTitle: 'Monsoon Music Festival 2026',
    upcomingEventDate: 'Nov 22, 2026',
  },
  {
    id: 'o4',
    name: 'VCCA',
    avatar:
      'https://images.pexels.com/photos/2559741/pexels-photo-2559741.jpeg?auto=compress&cs=tinysrgb&h=200&w=200',
    verified: true,
    eventCount: 24,
    hasMerchandise: false,
    category: 'Arts',
    upcomingEventTitle: 'Contemporary Art Exhibition: Boundless',
    upcomingEventDate: 'Sep 25, 2026',
  },
  {
    id: 'o5',
    name: 'V.League Official',
    avatar:
      'https://images.pexels.com/photos/30651230/pexels-photo-30651230.jpeg?auto=compress&cs=tinysrgb&h=200&w=200',
    verified: true,
    eventCount: 12,
    hasMerchandise: true,
    category: 'Sports',
    upcomingEventTitle: 'V.League Championship Final 2026',
    upcomingEventDate: 'Dec 15, 2026',
  },
  {
    id: 'o6',
    name: 'Tech Nation VN',
    avatar:
      'https://images.pexels.com/photos/29180747/pexels-photo-29180747.jpeg?auto=compress&cs=tinysrgb&h=200&w=200',
    verified: true,
    eventCount: 32,
    hasMerchandise: false,
    category: 'Technology',
    upcomingEventTitle: 'Vietnam Tech Summit 2026',
    upcomingEventDate: 'Nov 5, 2026',
  },
  {
    id: 'o7',
    name: 'Saigon Creative',
    avatar:
      'https://images.pexels.com/photos/15476611/pexels-photo-15476611.jpeg?auto=compress&cs=tinysrgb&h=200&w=200',
    verified: true,
    eventCount: 19,
    hasMerchandise: true,
    category: 'Arts',
    upcomingEventTitle: 'Street Art & Culture Festival',
    upcomingEventDate: 'Oct 30, 2026',
  },
  {
    id: 'o8',
    name: 'Craft Vietnam',
    avatar: '/images/art.jpg',
    verified: false,
    eventCount: 8,
    hasMerchandise: true,
    category: 'Workshops',
    upcomingEventTitle: 'Masterclass: Modern Pottery Techniques',
    upcomingEventDate: 'Oct 10, 2026',
  },
];

export const featuredEvents: Event[] = [
  {
    id: 'fe1',
    title: 'Coldplay: Music of the Spheres World Tour',
    category: 'Music',
    image:
      'https://images.pexels.com/photos/5193526/pexels-photo-5193526.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-11-15',
    dateLabel: 'Nov 15, 2026 · 7:00 PM',
    venue: 'My Dinh National Stadium',
    city: 'Ha Noi',
    startingPrice: 1800000,
    currency: 'VND',
    organizer: 'Live Nation Vietnam',
    status: 'on-sale',
    hotBadge: 'Hot',
  },
  {
    id: 'fe2',
    title: 'Sơn Tùng M-TP Live Concert 2026',
    category: 'Music',
    image:
      'https://images.pexels.com/photos/30215324/pexels-photo-30215324.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-10-18',
    dateLabel: 'Oct 18, 2026 · 8:00 PM',
    venue: 'My Dinh National Stadium',
    city: 'Ha Noi',
    startingPrice: 850000,
    currency: 'VND',
    organizer: 'Sơn Tùng M-TP',
    organizerId: 'o1',
    status: 'few-left',
    hotBadge: 'Trending',
  },
  {
    id: 'fe3',
    title: 'Monsoon Music Festival 2026',
    category: 'Festivals',
    image:
      'https://images.pexels.com/photos/17373843/pexels-photo-17373843.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-11-22',
    dateLabel: 'Nov 22, 2026 · 2:00 PM',
    venue: 'Thong Nhat Park',
    city: 'Ho Chi Minh City',
    startingPrice: 980000,
    currency: 'VND',
    organizer: 'Monsoon Festival',
    organizerId: 'o3',
    status: 'on-sale',
    hotBadge: "Editor's Pick",
  },
  {
    id: 'fe4',
    title: 'Manchester United vs Vietnam All Stars',
    category: 'Sports',
    image:
      'https://images.pexels.com/photos/30651230/pexels-photo-30651230.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-12-01',
    dateLabel: 'Dec 1, 2026 · 7:30 PM',
    venue: 'My Dinh National Stadium',
    city: 'Ha Noi',
    startingPrice: 1500000,
    currency: 'VND',
    organizer: 'V.League Official',
    organizerId: 'o5',
    status: 'few-left',
    hotBadge: 'Hot',
  },
];

export const exploreEvents: Event[] = [
  ...featuredEvents,
  {
    id: 'e2',
    title: 'Vietnam Tech Summit 2026',
    category: 'Technology',
    image:
      'https://images.pexels.com/photos/29180747/pexels-photo-29180747.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-11-05',
    dateLabel: 'Nov 5, 2026',
    venue: 'Saigon Exhibition Center',
    city: 'Ho Chi Minh City',
    startingPrice: 1200000,
    currency: 'VND',
    organizer: 'Tech Nation VN',
    organizerId: 'o6',
    status: 'on-sale',
  },
  {
    id: 'e4',
    title: 'Contemporary Art Exhibition: Boundless',
    category: 'Arts',
    image:
      'https://images.pexels.com/photos/2559741/pexels-photo-2559741.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-09-25',
    dateLabel: 'Sep 25, 2026',
    venue: 'Vincom Center for Contemporary Art',
    city: 'Ha Noi',
    startingPrice: 320000,
    currency: 'VND',
    organizer: 'VCCA',
    organizerId: 'o4',
    status: 'on-sale',
  },
  {
    id: 'e6',
    title: 'Masterclass: Modern Pottery Techniques',
    category: 'Workshops',
    image: '/images/art.jpg',
    date: '2026-10-10',
    dateLabel: 'Oct 10, 2026',
    venue: 'Bat Trang Ceramic Village',
    city: 'Ha Noi',
    startingPrice: 450000,
    currency: 'VND',
    organizer: 'Craft Vietnam',
    organizerId: 'o8',
    status: 'on-sale',
  },
  {
    id: 'u1',
    title: 'Đen Vâu Live Concert',
    category: 'Music',
    image:
      'https://images.pexels.com/photos/13230484/pexels-photo-13230484.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-10-25',
    dateLabel: 'Oct 25, 2026',
    venue: 'Army Stadium',
    city: 'Ha Noi',
    startingPrice: 650000,
    currency: 'VND',
    organizer: 'Đen Vâu',
    organizerId: 'o2',
    status: 'on-sale',
  },
  {
    id: 'u2',
    title: 'AI & Robotics Innovation Forum',
    category: 'Technology',
    image:
      'https://images.pexels.com/photos/1708909/pexels-photo-1708909.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-11-08',
    dateLabel: 'Nov 8, 2026',
    venue: 'Ariyana Convention Center',
    city: 'Da Nang',
    startingPrice: 1100000,
    currency: 'VND',
    organizer: 'Innovation Hub VN',
    status: 'coming-soon',
  },
  {
    id: 'u3',
    title: 'V.League Championship Final 2026',
    category: 'Sports',
    image:
      'https://images.pexels.com/photos/32471037/pexels-photo-32471037.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-12-15',
    dateLabel: 'Dec 15, 2026',
    venue: 'Thong Nhat Stadium',
    city: 'Ho Chi Minh City',
    startingPrice: 550000,
    currency: 'VND',
    organizer: 'V.League Official',
    organizerId: 'o5',
    status: 'few-left',
  },
  {
    id: 'u4',
    title: 'Street Art & Culture Festival',
    category: 'Arts',
    image:
      'https://images.pexels.com/photos/15476611/pexels-photo-15476611.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-10-30',
    dateLabel: 'Oct 30, 2026',
    venue: 'Nguyen Hue Walking Street',
    city: 'Ho Chi Minh City',
    startingPrice: 280000,
    currency: 'VND',
    organizer: 'Saigon Creative',
    organizerId: 'o7',
    status: 'on-sale',
  },
  {
    id: 'u5',
    title: 'Photography Masterclass with National Geographic',
    category: 'Workshops',
    image:
      'https://images.pexels.com/photos/39201792/pexels-photo-39201792.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-11-12',
    dateLabel: 'Nov 12, 2026',
    venue: 'Sofitel Saigon Plaza',
    city: 'Ho Chi Minh City',
    startingPrice: 750000,
    currency: 'VND',
    organizer: 'Aperture Academy',
    status: 'on-sale',
  },
  {
    id: 'u6',
    title: 'Countdown 2027 New Year Festival',
    category: 'Festivals',
    image:
      'https://images.pexels.com/photos/30247038/pexels-photo-30247038.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-12-31',
    dateLabel: 'Dec 31, 2026',
    venue: 'Ba Khuong Lake Park',
    city: 'Da Nang',
    startingPrice: 1200000,
    currency: 'VND',
    organizer: 'Midnight Events',
    status: 'coming-soon',
  },
];

export const resaleTickets: ResaleTicket[] = [
  {
    id: 'r1',
    eventTitle: 'Coldplay: Music of the Spheres',
    image:
      'https://images.pexels.com/photos/5193526/pexels-photo-5193526.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-11-15',
    dateLabel: 'Nov 15, 2026',
    venue: 'My Dinh National Stadium',
    city: 'Ha Noi',
    seatInfo: 'Block B, Row 12, Seats 5-6',
    resalePrice: 2500000,
    originalPrice: 1800000,
    currency: 'VND',
    sellerVerified: true,
    timeLeft: '2d 14h left',
  },
  {
    id: 'r2',
    eventTitle: 'Sơn Tùng M-TP Live Concert 2026',
    image:
      'https://images.pexels.com/photos/30215324/pexels-photo-30215324.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-10-18',
    dateLabel: 'Oct 18, 2026',
    venue: 'My Dinh National Stadium',
    city: 'Ha Noi',
    seatInfo: 'VIP Area, Row 3, Seat 8',
    resalePrice: 1500000,
    originalPrice: 850000,
    currency: 'VND',
    sellerVerified: true,
    timeLeft: '5h 30m left',
  },
  {
    id: 'r3',
    eventTitle: 'Monsoon Music Festival 2026',
    image:
      'https://images.pexels.com/photos/17373843/pexels-photo-17373843.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-11-22',
    dateLabel: 'Nov 22, 2026',
    venue: 'Thong Nhat Park',
    city: 'Ho Chi Minh City',
    seatInfo: 'GA Pass · 2-Day Wristband',
    resalePrice: 1300000,
    originalPrice: 980000,
    currency: 'VND',
    sellerVerified: true,
    timeLeft: '3d 8h left',
  },
  {
    id: 'r4',
    eventTitle: 'Manchester United vs Vietnam All Stars',
    image:
      'https://images.pexels.com/photos/30651230/pexels-photo-30651230.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-12-01',
    dateLabel: 'Dec 1, 2026',
    venue: 'My Dinh National Stadium',
    city: 'Ha Noi',
    seatInfo: 'Block A, Row 5, Seats 10-11',
    resalePrice: 2200000,
    originalPrice: 1500000,
    currency: 'VND',
    sellerVerified: false,
    timeLeft: '6d 2h left',
  },
];

export const locations = [
  {
    name: 'Hồ Chí Minh',
    eventCount: 1240,
    image:
      'https://images.pexels.com/photos/15476611/pexels-photo-15476611.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  },
  {
    name: 'Hà Nội',
    eventCount: 980,
    image:
      'https://images.pexels.com/photos/30215324/pexels-photo-30215324.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  },
  {
    name: 'Đà Nẵng',
    eventCount: 420,
    image:
      'https://images.pexels.com/photos/17373843/pexels-photo-17373843.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  },
  {
    name: 'Huế',
    eventCount: 180,
    image:
      'https://images.pexels.com/photos/2559741/pexels-photo-2559741.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  },
  {
    name: 'Hải Phòng',
    eventCount: 95,
    image:
      'https://images.pexels.com/photos/30651230/pexels-photo-30651230.jpeg?auto=compress&cs=tinysrgb&h=400&w=600',
  },
];

export const officialEvents: OfficialEvent[] = [
  {
    id: 'oe1',
    title: 'VPBank Tech Innovators Summit 2026',
    image:
      'https://images.pexels.com/photos/9275222/pexels-photo-9275222.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-10-20',
    dateLabel: 'Oct 20, 2026',
    venue: 'JW Marriott, Ha Noi',
    organizer: 'VPBank',
    category: 'Business',
    badge: 'Official Partner',
  },
  {
    id: 'oe2',
    title: 'National Digital Transformation Conference',
    image:
      'https://images.pexels.com/photos/26202153/pexels-photo-26202153.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-11-10',
    dateLabel: 'Nov 10, 2026',
    venue: 'National Convention Center',
    organizer: 'Ministry of Information & Communications',
    category: 'Official',
    badge: 'National Event',
  },
  {
    id: 'oe3',
    title: 'VinGroup Partner Business Forum',
    image:
      'https://images.pexels.com/photos/8761738/pexels-photo-8761738.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-12-05',
    dateLabel: 'Dec 5, 2026',
    venue: 'Vinpearl Resort, Da Nang',
    organizer: 'VinGroup',
    category: 'Business',
    badge: 'Partner Event',
  },
  {
    id: 'oe4',
    title: 'FPT Sponsorship Launch: Youth Coding Championship',
    image:
      'https://images.pexels.com/photos/7648472/pexels-photo-7648472.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: '2026-10-28',
    dateLabel: 'Oct 28, 2026',
    venue: 'FPT Tower, Ho Chi Minh City',
    organizer: 'FPT Corporation',
    category: 'Sponsor',
    badge: 'Sponsored',
  },
];

export const merchandise: MerchandiseProduct[] = [
  {
    id: 'm1',
    name: 'Sơn Tùng M-TP Tour 2026 T-Shirt',
    image:
      'https://images.pexels.com/photos/13632832/pexels-photo-13632832.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',
    price: 350000,
    currency: 'VND',
    organizer: 'Sơn Tùng M-TP',
    organizerId: 'o1',
    badge: 'Best Seller',
    eventTitle: 'Sơn Tùng M-TP Live Concert 2026',
  },
  {
    id: 'm2',
    name: 'Sơn Tùng M-TP Hoodie — Sky Tour',
    image:
      'https://images.pexels.com/photos/14389775/pexels-photo-14389775.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',
    price: 650000,
    currency: 'VND',
    organizer: 'Sơn Tùng M-TP',
    organizerId: 'o1',
    badge: 'Limited',
    eventTitle: 'Sơn Tùng M-TP Live Concert 2026',
  },
  {
    id: 'm3',
    name: 'Sơn Tùng M-TP Lightstick V2',
    image:
      'https://images.pexels.com/photos/29755921/pexels-photo-29755921.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',
    price: 420000,
    currency: 'VND',
    organizer: 'Sơn Tùng M-TP',
    organizerId: 'o1',
    badge: 'New',
    eventTitle: 'Sơn Tùng M-TP Live Concert 2026',
  },
  {
    id: 'm4',
    name: 'Đen Vâu Vinyl — Trời Làm Trời Mưa',
    image:
      'https://images.pexels.com/photos/5764281/pexels-photo-5764281.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',
    price: 680000,
    currency: 'VND',
    organizer: 'Đen Vâu',
    organizerId: 'o2',
    badge: 'Limited',
    eventTitle: 'Đen Vâu Live Concert',
  },
  {
    id: 'm5',
    name: 'Đen Vâu Tote Bag — Làm',
    image:
      'https://images.pexels.com/photos/1214212/pexels-photo-1214212.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',
    price: 180000,
    currency: 'VND',
    organizer: 'Đen Vâu',
    organizerId: 'o2',
    badge: null,
    eventTitle: 'Đen Vâu Live Concert',
  },
  {
    id: 'm6',
    name: 'Monsoon Festival 2026 Wristband',
    image:
      'https://images.pexels.com/photos/27694129/pexels-photo-27694129.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',
    price: 120000,
    currency: 'VND',
    organizer: 'Monsoon Festival',
    organizerId: 'o3',
    badge: 'New',
    eventTitle: 'Monsoon Music Festival 2026',
  },
  {
    id: 'm7',
    name: 'Monsoon Festival Vinyl Edition',
    image:
      'https://images.pexels.com/photos/31805824/pexels-photo-31805824.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',
    price: 580000,
    currency: 'VND',
    organizer: 'Monsoon Festival',
    organizerId: 'o3',
    badge: 'Best Seller',
    eventTitle: 'Monsoon Music Festival 2026',
  },
  {
    id: 'm8',
    name: 'V.League Official T-Shirt 2026',
    image:
      'https://images.pexels.com/photos/20248584/pexels-photo-20248584.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',
    price: 290000,
    currency: 'VND',
    organizer: 'V.League Official',
    organizerId: 'o5',
    badge: 'New',
    eventTitle: 'V.League Championship Final 2026',
  },
  {
    id: 'm9',
    name: 'Saigon Creative Art Print Set',
    image:
      'https://images.pexels.com/photos/908965/pexels-photo-908965.jpeg?auto=compress&cs=tinysrgb&h=600&w=600',
    price: 420000,
    currency: 'VND',
    organizer: 'Saigon Creative',
    organizerId: 'o7',
    badge: null,
    eventTitle: 'Street Art & Culture Festival',
  },
  {
    id: 'm10',
    name: 'Craft Vietnam Pottery DIY Kit',
    image: '/images/art.jpg',
    price: 290000,
    currency: 'VND',
    organizer: 'Craft Vietnam',
    organizerId: 'o8',
    badge: 'New',
    eventTitle: 'Masterclass: Modern Pottery Techniques',
  },
];

export const blogPosts: BlogPost[] = [
  {
    id: 'b1',
    title: 'The Rise of Live Music in Vietnam: 2026 Industry Report',
    excerpt:
      "From stadium concerts to intimate venues, Vietnam's live music scene is booming. We break down the numbers and trends shaping the industry.",
    image:
      'https://images.pexels.com/photos/20993079/pexels-photo-20993079.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: 'Sep 8, 2026',
    category: 'Industry',
    readTime: '8 min read',
  },
  {
    id: 'b2',
    title: 'How to Choose the Perfect Festival Lineup This Season',
    excerpt:
      'A guide to navigating the packed festival calendar — from Monsoon to Countdown — and making the most of every weekend.',
    image:
      'https://images.pexels.com/photos/12657546/pexels-photo-12657546.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: 'Sep 5, 2026',
    category: 'Guides',
    readTime: '5 min read',
  },
  {
    id: 'b3',
    title: 'Behind the Scenes: Organizing a Stadium Concert in Ha Noi',
    excerpt:
      'We sit down with Live Nation Vietnam to discuss logistics, stage design, and what it takes to host 40,000 fans.',
    image:
      'https://images.pexels.com/photos/32399568/pexels-photo-32399568.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
    date: 'Sep 1, 2026',
    category: 'Interviews',
    readTime: '12 min read',
  },
];

// Legacy exports kept for backward compatibility
export const trendingEvents = featuredEvents;
export const featuredEvent = featuredEvents[0];
export const upcomingEvents = exploreEvents.slice(4);
