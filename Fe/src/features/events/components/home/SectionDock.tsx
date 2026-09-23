import { ui } from '../../../../shared/styles/classes';
import { useEffect, useState } from 'react';
import {
  Star,
  Flame,
  Compass,
  Ticket,
  MapPin,
  Sparkles,
  ShoppingBag,
  BookOpen,
} from 'lucide-react';

const sectionLinks = [
  { label: 'Stars', href: '#stars', icon: Star },
  { label: 'Trending', href: '#featured', icon: Flame },
  { label: 'Explore', href: '#discover', icon: Compass },
  { label: 'Resale', href: '#resale', icon: Ticket },
  { label: 'Locations', href: '#locations', icon: MapPin },
  { label: 'Spotlight', href: '#spotlight', icon: Sparkles },
  { label: 'Merch', href: '#merchandise', icon: ShoppingBag },
  { label: 'Blog', href: '#blog', icon: BookOpen },
] as const;

export default function SectionDock() {
  const [active, setActive] = useState<string>(sectionLinks[0].href);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const filterRail = document.getElementById('categories');
    const sections = sectionLinks
      .map(({ href }) => document.getElementById(href.slice(1)))
      .filter((section): section is HTMLElement => Boolean(section));
    let frame: number | undefined;
    const update = () => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        setVisible(Boolean(filterRail && filterRail.getBoundingClientRect().bottom < 72));
        const marker = window.scrollY + Math.min(window.innerHeight * 0.32, 280);
        const current = sections.reduce(
          (match, section) => (section.offsetTop <= marker ? section : match),
          sections[0],
        );
        if (current) setActive(`#${current.id}`);
        frame = undefined;
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav
      aria-label="Đi tới nội dung"
      aria-hidden={!visible}
      className={ui(
        visible
          ? 'catalog-floating catalog-dock-visible fixed bottom-4 left-0 right-0 z-40 px-4'
          : 'catalog-floating catalog-dock-hidden fixed bottom-4 left-0 right-0 z-40 px-4',
      )}
    >
      <div className="mx-auto max-w-7xl rounded-2xl border border-ink-200/80 bg-white/95 px-1 shadow-elevated backdrop-blur-xl sm:px-2">
        <div className="grid grid-cols-8 gap-0.5 py-2 sm:gap-1">
          {sectionLinks.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.href}
                href={link.href}
                aria-label={link.label}
                title={link.label}
                tabIndex={visible ? undefined : -1}
                aria-current={active === link.href ? 'location' : undefined}
                onClick={() => setActive(link.href)}
                className={ui(
                  `flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-full px-0.5 py-2 text-center text-xs font-semibold leading-none transition-colors duration-300 lg:px-1 ${
                    active === link.href
                      ? 'bg-home-accent-soft text-home-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,_var(--home-accent)_35%,_transparent)]'
                      : 'bg-home-card text-home-muted hover:bg-home-hover hover:text-home-text'
                  }`,
                )}
              >
                <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
                <span className="hidden whitespace-nowrap lg:inline">{link.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
