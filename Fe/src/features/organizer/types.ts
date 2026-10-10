export interface Organizer {
  id: string;
  name: string;
  avatar: string;
  summary: string;
  verified: boolean;
  eventCount: number;
  hasMerchandise: boolean;
  category: string;
  upcomingEventTitle: string | null;
  upcomingEventDate: string | null;
  upcomingEventId: string | null;
}
