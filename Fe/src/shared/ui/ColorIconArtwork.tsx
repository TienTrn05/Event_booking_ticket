import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Compass,
  Drama,
  HeartHandshake,
  LayoutDashboard,
  Music2,
  Package,
  RotateCcw,
  ShieldCheck,
  Search,
  ShoppingBag,
  Sparkles,
  Ticket,
  Trees,
  Trophy,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';

const blue = 'var(--art-blue)';
const purple = 'var(--art-purple)';
const coral = 'var(--art-coral)';
const gold = 'var(--art-gold)';
const mint = 'var(--art-mint)';
const ink = 'var(--art-ink)';
const paper = 'var(--art-paper)';

/** Filled illustrations for the app's actual destinations; SVG stays crisp at rail size. */
export const colorIconArtwork = new Map<LucideIcon, ReactNode>([
  [
    Search,
    <>
      <path d="m20 20 9 9" stroke={purple} strokeWidth="5" />
      <circle cx="13" cy="13" r="11" fill={blue} />
      <circle cx="13" cy="13" r="7" fill={paper} />
      <path d="M9 12a4 4 0 0 1 4-4" fill="none" stroke={mint} strokeWidth="2.5" />
    </>,
  ],
  [
    Compass,
    <>
      <circle cx="16" cy="16" r="13" fill={blue} />
      <circle cx="16" cy="16" r="9.5" fill={paper} />
      <path d="m22 10-3 9-9 3 3-9Z" fill={coral} />
      <path d="m22 10-6 6-6 6 3-9Z" fill={purple} />
      <circle cx="16" cy="16" r="2" fill={ink} />
      <path d="M16 4v2m12 10h-2M16 28v-2M4 16h2" stroke={ink} strokeWidth="1.5" />
    </>,
  ],
  [
    Ticket,
    <>
      <path d="M5 7h22v6a3 3 0 0 0 0 6v6H5v-6a3 3 0 0 0 0-6Z" fill={coral} />
      <path d="M22 7h5v6a3 3 0 0 0 0 6v6h-5Z" fill={purple} />
      <path d="M21 10v12" stroke={paper} strokeWidth="1.5" strokeDasharray="2 3" />
      <path d="m12 11 1.5 3 3.5.5-2.5 2.4.6 3.5-3.1-1.6-3.1 1.6.6-3.5L7 14.5l3.5-.5Z" fill={gold} />
    </>,
  ],
  [
    Package,
    <>
      <path d="m16 3 12 7-12 7L4 10Z" fill={gold} />
      <path d="M4 10v14l12 6V17Z" fill={coral} />
      <path d="M28 10v14l-12 6V17Z" fill={blue} />
      <path d="m10 6 12 7v7l-4 2v-7L6 8Z" fill={paper} opacity=".85" />
      <path d="m7 22 5 2.5" stroke={ink} strokeWidth="1.6" />
    </>,
  ],
  [
    Music2,
    <>
      <path d="M12 9v14h3V13l11-3v10h3V3Z" fill={purple} />
      <ellipse cx="9" cy="24" rx="6" ry="4.5" fill={purple} />
      <ellipse cx="23" cy="21" rx="6" ry="4.5" fill={coral} />
      <path d="m3 6 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" fill={gold} />
      <path d="M18 5v3" stroke={blue} strokeWidth="2" />
    </>,
  ],
  [
    Trophy,
    <>
      <path
        d="M9 7H4v5a7 7 0 0 0 8 7m11-12h5v5a7 7 0 0 1-8 7"
        fill="none"
        stroke={coral}
        strokeWidth="3"
      />
      <path d="M8 4h16v9a8 8 0 0 1-16 0Z" fill={gold} />
      <path d="M16 4h8v9a8 8 0 0 1-8 8Z" fill={coral} opacity=".55" />
      <path d="M14 20h4v6h-4Z" fill={purple} />
      <rect x="9" y="25" width="14" height="4" rx="2" fill={purple} />
      <path d="m16 7 1.2 2.5 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4Z" fill={paper} />
    </>,
  ],
  [
    Drama,
    <>
      <path d="M3 5c5 3 9 3 14 0v10c0 6-7 10-7 10S3 21 3 15Z" fill={purple} />
      <path d="M15 10c5 3 9 3 14 0v10c0 6-7 10-7 10s-7-4-7-10Z" fill={coral} />
      <path
        d="m6 11 2 1m4 0 2-1m-7 6c2-2 4-2 6 0m5-1 2 1m4 0 2-1m-7 6c2 3 4 3 6 0"
        fill="none"
        stroke={paper}
        strokeWidth="1.8"
      />
      <circle cx="25" cy="5" r="2" fill={gold} />
    </>,
  ],
  [
    Users,
    <>
      <circle cx="11" cy="10" r="5" fill={gold} />
      <circle cx="23" cy="11" r="4" fill={coral} />
      <path d="M1 28v-3a10 10 0 0 1 20 0v3Z" fill={blue} />
      <path d="M20 18a8 8 0 0 1 11 7v3H21v-3a12 12 0 0 0-1-7Z" fill={purple} />
      <path d="M8 10v1m6-1v1" stroke={ink} strokeWidth="1.6" />
    </>,
  ],
  [
    Trees,
    <>
      <circle cx="25" cy="7" r="4" fill={gold} />
      <path d="M5 27h24l-8-10-5 5-4-5Z" fill={mint} />
      <path d="M9 13v16" stroke={ink} strokeWidth="3" />
      <path d="m9 2 7 11h-3l5 7H0l5-7H2Z" fill={mint} />
      <path d="m9 2 7 11h-3l5 7H9Z" fill={blue} opacity=".5" />
    </>,
  ],
  [
    Sparkles,
    <>
      <path d="m14 2 4.5 9.5L29 16l-10.5 4.5L14 30 9.5 20.5 0 16l9.5-4.5Z" fill={purple} />
      <path d="m14 2 4.5 9.5L29 16H14Z" fill={coral} />
      <path d="m27 1 1.5 4.5L33 7l-4.5 1.5L27 13l-1.5-4.5L21 7l4.5-1.5Z" fill={gold} />
      <circle cx="29" cy="26" r="2" fill={blue} />
    </>,
  ],
  [
    BookOpen,
    <>
      <path d="M2 5c5-2 10-1 14 2 4-3 9-4 14-2v23c-6-2-10-1-14 2-4-3-8-4-14-2Z" fill={blue} />
      <path d="M5 4c4-1 7 0 11 3v19c-4-3-7-4-11-3Z" fill={paper} />
      <path d="M27 4c-4-1-7 0-11 3v19c4-3 7-4 11-3Z" fill={gold} />
      <path d="m8 10 5 2m-5 3 5 2m7-5 4-2m-4 7 4-2" stroke={purple} strokeWidth="1.7" />
    </>,
  ],
  [
    CalendarDays,
    <>
      <rect x="3" y="5" width="26" height="25" rx="6" fill={blue} />
      <path d="M3 11h26v2H3Z" fill={purple} />
      <path d="M9 3v6m14-6v6" stroke={ink} strokeWidth="3" />
      <rect x="6" y="15" width="20" height="12" rx="3" fill={paper} />
      <path d="m10 21 3 3 8-6" fill="none" stroke={coral} strokeWidth="3" />
    </>,
  ],
  [
    LayoutDashboard,
    <>
      <rect x="3" y="3" width="12" height="16" rx="4" fill={blue} />
      <rect x="18" y="3" width="11" height="10" rx="4" fill={coral} />
      <rect x="3" y="22" width="12" height="7" rx="3" fill={gold} />
      <rect x="18" y="16" width="11" height="13" rx="4" fill={purple} />
      <path d="M7 8h4m-4 4h2m13 9h3" stroke={paper} strokeWidth="2" />
    </>,
  ],
  [
    ClipboardList,
    <>
      <rect x="5" y="5" width="23" height="25" rx="5" fill={purple} />
      <rect x="8" y="9" width="17" height="18" rx="3" fill={paper} />
      <rect x="11" y="2" width="11" height="7" rx="3" fill={gold} />
      <path d="m11 15 1 1 2-2m-3 8 1 1 2-2" stroke={mint} strokeWidth="2" />
      <path d="M18 15h4m-4 7h4" stroke={blue} strokeWidth="2" />
    </>,
  ],
  [
    ShieldCheck,
    <>
      <path d="M16 2c5 4 8 4 13 5v10c0 7-7 11-13 14C10 28 3 24 3 17V7c5-1 8-1 13-5Z" fill={mint} />
      <path d="M16 2c5 4 8 4 13 5v10c0 7-7 11-13 14Z" fill={blue} opacity=".65" />
      <path d="m9 16 5 5 10-11" fill="none" stroke={paper} strokeWidth="3.5" />
    </>,
  ],
  [
    CheckCheck,
    <>
      <circle cx="15" cy="16" r="13" fill={mint} />
      <path d="m4 16 5 5L22 8" fill="none" stroke={paper} strokeWidth="3" />
      <path d="m16 20 3 3L30 11" fill="none" stroke={blue} strokeWidth="3" />
    </>,
  ],
  [
    UserRound,
    <>
      <path d="M3 30v-4a13 13 0 0 1 26 0v4Z" fill={purple} />
      <path d="M16 14a13 13 0 0 1 13 12v4H16Z" fill={blue} />
      <circle cx="16" cy="10" r="8" fill={gold} />
      <path d="M12 10v1m8-1v1m-6 3c1 1 3 1 4 0" fill="none" stroke={ink} strokeWidth="1.6" />
    </>,
  ],
  [
    ShoppingBag,
    <>
      <path d="M5 10h22l3 20H2Z" fill={coral} />
      <path d="M18 10h9l3 20H18Z" fill={purple} opacity=".65" />
      <path d="M10 12V8a6 6 0 0 1 12 0v4" fill="none" stroke={ink} strokeWidth="2.5" />
      <path d="m14 16 1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.7-3 1.7.5-3.5L9 19.5l3.5-.5Z" fill={gold} />
    </>,
  ],
  [
    HeartHandshake,
    <>
      <path d="M16 29 4 17C-4 8 8-1 16 8 24-1 36 8 28 17Z" fill={coral} />
      <path d="m6 17 6-6h6l5 5-8 8Z" fill={paper} />
      <path d="m12 16 4-4 5 4" fill="none" stroke={purple} strokeWidth="2" />
    </>,
  ],
  [
    RotateCcw,
    <>
      <path d="M8 14h19v4a3 3 0 0 0 0 6v4H8v-4a3 3 0 0 0 0-6Z" fill={coral} />
      <path d="M20 17v8" stroke={paper} strokeWidth="1.5" strokeDasharray="2 2" />
      <path d="M5 12a11 11 0 0 1 20-5" fill="none" stroke={blue} strokeWidth="3" />
      <path d="m2 5 3 9 7-6Z" fill={blue} />
    </>,
  ],
  [
    ArrowLeft,
    <>
      <circle cx="16" cy="16" r="14" fill={blue} />
      <path d="m16 8-9 8 9 8v-5h10v-6H16Z" fill={paper} />
    </>,
  ],
]);
