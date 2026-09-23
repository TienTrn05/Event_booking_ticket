import { ui } from '../styles/classes';
import {
  Compass,
  Sparkles,
  MapPin,
  ShoppingBag,
  BookOpen,
  ShieldCheck,
  Ticket,
  Mic2,
  Layers,
} from 'lucide-react';
const icons = {
  discover: Compass,
  featured: Sparkles,
  locations: MapPin,
  merchandise: ShoppingBag,
  blog: BookOpen,
  partners: ShieldCheck,
  resale: Ticket,
  stars: Mic2,
  organizers: Layers,
};
export function SectionEmblem({ kind }: { kind: keyof typeof icons }) {
  const Icon = icons[kind];
  return (
    <span className={ui('section-emblem')} aria-hidden="true">
      <Icon size={22} strokeWidth={1.7} />
    </span>
  );
}
