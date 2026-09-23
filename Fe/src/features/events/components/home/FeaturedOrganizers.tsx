import { ui } from '../../../../shared/styles/classes';
import { SectionEmblem } from '../../../../shared/ui/SectionEmblem';
import { BadgeCheck, ArrowRight } from 'lucide-react';
import { organizers } from '../../../organizer/data/organizers';
import { useQuickPreview } from '../../../preview/hooks/useQuickPreview';

export default function FeaturedOrganizers() {
  const { openPreview } = useQuickPreview();

  return (
    <section
      id="stars"
      className={ui(
        'home-chapter chapter-stars stars-section relative isolate overflow-hidden py-14 lg:py-20',
      )}
    >
      <div aria-hidden="true" className="stars-backdrop pointer-events-none absolute inset-0">
        <svg
          className="stars-waves absolute inset-0 h-full w-full"
          viewBox="0 0 1600 420"
          preserveAspectRatio="none"
        >
          <path d="M-100 250 C 170 350, 330 80, 540 185 S 890 315, 1120 180 S 1390 105, 1700 230" />
          <path d="M-100 310 C 170 160, 350 265, 560 150 S 900 150, 1120 280 S 1430 140, 1700 190" />
          <path d="M-80 110 C 210 30, 380 170, 560 250 S 930 130, 1130 180 S 1420 300, 1700 160" />
          <path d="M-100 370 C 250 200, 390 360, 620 260 S 980 270, 1200 340 S 1450 250, 1700 320" />

          <path d="M-120 210 C 120 120, 320 300, 560 220 S 930 120, 1160 210 S 1450 330, 1720 240" />
          <path d="M-90 145 C 140 260, 320 60, 520 145 S 900 310, 1140 210 S 1450 70, 1710 155" />
          <path d="M-110 285 C 180 410, 360 140, 560 215 S 900 255, 1120 205 S 1430 145, 1700 245" />
          <path d="M-70 75 C 190 10, 400 140, 620 120 S 970 55, 1180 170 S 1470 260, 1710 130" />
        </svg>
      </div>
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <SectionEmblem kind="stars" />
            <h2
              data-reveal="soft-heading"
              className="stars-title mt-2 text-3xl font-extrabold tracking-tight"
            >
              Feature Stars
            </h2>
          </div>
          <a
            href="#organizers"
            className="stars-all-link inline-flex items-center gap-2 text-sm font-bold"
          >
            For organizers <ArrowRight size={16} />
          </a>
        </div>
        <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0">
          {organizers.map((org) => (
            <article
              data-reveal
              key={org.id}
              role="button"
              tabIndex={0}
              onClick={() => openPreview('organizer', org.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openPreview('organizer', org.id);
                }
              }}
              className="stars-card group relative flex min-h-[180px] w-[164px] shrink-0 flex-col items-center justify-center rounded-2xl p-4 text-center"
            >
              <div className="relative mb-3">
                <div className="stars-avatar h-[104px] w-[104px] overflow-hidden rounded-full border-2 p-0.5">
                  <img
                    src={org.avatar}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                    loading="lazy"
                  />
                </div>
                {org.verified && (
                  <span
                    className="stars-verified absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2"
                    aria-label="Verified organizer"
                  >
                    <BadgeCheck size={17} />
                  </span>
                )}
              </div>
              <h3 className="stars-name w-full truncate text-sm font-extrabold">{org.name}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
