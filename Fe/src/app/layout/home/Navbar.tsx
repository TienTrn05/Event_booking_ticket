import { ui } from '../../../shared/styles/classes';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Menu, X, ArrowUpRight, Search } from 'lucide-react';
import { ThemePicker } from '../../../shared/theme/ThemePicker';
const links = [
  { label: 'Discover', href: '#discover' },
  { label: 'Categories', href: '#categories' },
  { label: 'Merchandise', href: '#merchandise' },
  { label: 'For Organizers', href: '#organizers' },
];
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState('#discover');
  const lastY = useRef(0);
  const scrollFrame = useRef<number | null>(null);
  useEffect(() => {
    const onScroll = () => {
      if (scrollFrame.current !== null) return;
      scrollFrame.current = requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);
        const delta = y - lastY.current;
        if (y < 80) setHidden(false);
        else if (y > 140 && delta > 16) setHidden(true);
        else if (delta < -22) setHidden(false);
        lastY.current = y;
        scrollFrame.current = null;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    };
  }, []);
  useEffect(() => {
    const sections = links
      .map(({ href }) => document.getElementById(href.slice(1)))
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(`#${visible.target.id}`);
      },
      { rootMargin: '-25% 0px -60% 0px', threshold: [0, 0.15, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return (
    <header
      className={ui(
        hidden && !open
          ? 'home-navbar nav-hidden !animate-nav-arrive'
          : 'home-navbar nav-visible !animate-nav-arrive',
      )}
    >
      <nav className={ui('home-nav')} aria-label="Main navigation">
        <Link to="/" className={ui('brand-lockup home-brand')}>
          <span className={ui('brand-mark')} aria-hidden="true">
            <Ticket size={23} />
            <span className={ui('brand-mark-dot')} />
          </span>
          <span>
            <strong>Eventix</strong>
            <small>Make it memorable</small>
          </span>
        </Link>
        <div className={ui('home-nav-links')}>
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              aria-current={active === link.href ? 'location' : undefined}
              onClick={() => setActive(link.href)}
            >
              {link.label}
            </a>
          ))}
        </div>
        <div className={ui('home-nav-actions')}>
          <a className={ui('nav-search')} href="#discover" aria-label="Search events">
            <Search size={19} />
          </a>
          <ThemePicker />
          <Link className={ui('nav-tickets')} to="/my-tickets">
            <Ticket size={17} /> My Tickets
          </Link>
          <Link className={ui('nav-create home-cta')} to="/organizer">
            Create event <ArrowUpRight size={16} />
          </Link>
        </div>
        <button
          className={ui('nav-menu')}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="home-mobile-menu"
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      <div
        id="home-mobile-menu"
        aria-hidden={!open}
        className={ui(
          open ? 'home-mobile-menu mobile-menu-open' : 'home-mobile-menu mobile-menu-closed',
        )}
      >
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            tabIndex={open ? 0 : -1}
            aria-current={active === link.href ? 'location' : undefined}
            onClick={() => {
              setActive(link.href);
              setOpen(false);
            }}
          >
            {link.label}
          </a>
        ))}
        <Link tabIndex={open ? 0 : -1} to="/my-tickets">
          My Tickets
        </Link>
        <Link tabIndex={open ? 0 : -1} to="/organizer">
          Create event
        </Link>
      </div>
    </header>
  );
}
