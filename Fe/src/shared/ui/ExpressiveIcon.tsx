import type { LucideIcon } from 'lucide-react';
import { colorIconArtwork } from './ColorIconArtwork';

/** Filled, multicolor illustrations shared by navigation and section headings. */
export function ExpressiveIcon({
  icon: Icon,
  tone = 'blue',
  size = 26,
}: {
  icon: LucideIcon;
  tone?: 'blue' | 'violet' | 'coral' | 'green' | 'amber';
  size?: number;
}) {
  const artwork = colorIconArtwork.get(Icon);
  return (
    <span className="expressive-icon" data-tone={tone} aria-hidden="true">
      {artwork ? (
        <svg
          className="expressive-icon-art"
          data-filled-icon
          width={size + 4}
          height={size + 4}
          viewBox="0 0 32 32"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {artwork}
        </svg>
      ) : (
        <Icon size={size} strokeWidth={2} />
      )}
    </span>
  );
}
