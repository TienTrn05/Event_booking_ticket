import { ui } from '../../../../shared/styles/classes';
import { useEffect, useState } from 'react';

const sectionLinks = [
  { label: 'Feature Stars', href: '#stars' },
  { label: 'Trending', href: '#featured' },
  { label: 'Moments Await', href: '#discover' },
  { label: 'Resale tickets.', href: '#resale' },
  { label: 'Somewhere Worth Going', href: '#locations' },
  { label: 'The Spotlight', href: '#spotlight' },
  { label: 'Merchandise', href: '#merchandise' },
  { label: 'Blog & Insights', href: '#blog' },
  { label: 'Every Great Night Starts with an Idea', href: '#organizers' },
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

  useEffect(() => {
    const activeLink = document.querySelector<HTMLAnchorElement>(
      `.catalog-floating [data-section-link="${active.slice(1)}"]`,
    );
    const rail = activeLink?.parentElement;
    if (!activeLink || !rail) return;
    rail.scrollTo({
      left: activeLink.offsetLeft - (rail.clientWidth - activeLink.offsetWidth) / 2,
      behavior: 'smooth',
    });
  }, [active]);

  return (
    <nav
      aria-label="Đi tới nội dung"
      aria-hidden={!visible}
      className={ui(
        visible
          ? 'catalog-floating catalog-dock-visible fixed bottom-4 left-0 right-0 z-40 px-4 !animate-dock-arrive'
          : 'catalog-floating catalog-dock-hidden fixed bottom-4 left-0 right-0 z-40 px-4',
      )}
    >
      <div className="max-w-6xl mx-auto rounded-2xl border border-ink-200/80 bg-white/95 px-2 shadow-elevated backdrop-blur-xl">
        <div className={ui('flex items-center gap-2 overflow-x-auto no-scrollbar py-3')}>
          {sectionLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              data-section-link={link.href.slice(1)}
              tabIndex={visible ? undefined : -1}
              aria-current={active === link.href ? 'location' : undefined}
              onClick={() => setActive(link.href)}
              className={ui(
                `inline-flex min-h-11 items-center px-4 py-2 text-sm font-semibold rounded-full whitespace-nowrap transition-all duration-300 ${
                  active === link.href
                    ? 'bg-home-accent-soft text-home-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,_var(--home-accent)_35%,_transparent)]'
                    : 'bg-home-card text-home-muted hover:bg-home-hover hover:text-home-text'
                }`,
              )}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}
