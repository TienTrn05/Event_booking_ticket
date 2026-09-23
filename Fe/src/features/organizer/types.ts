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
