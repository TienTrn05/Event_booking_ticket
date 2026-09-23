import { ui } from '../../../shared/styles/classes';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Menu, X, ArrowUpRight, Search, UserRound } from 'lucide-react';
import { ThemePicker } from '../../../shared/theme/ThemePicker';
import { useAuthDialog } from '../../../features/auth/context/AuthDialogContext';
import { scrollToTop } from '../../../shared/motion/scroll';
import { useLocation } from 'react-router-dom';
const links = [
  { label: 'Categories', href: '#categories' },
  { label: 'Discover', href: '#discover' },
  { label: 'Merchandise', href: '#merchandise' },
  { label: 'For Organizers', href: '#organizers' },
];
export default function Navbar() {
  const location = useLocation();
  const { openAuth } = useAuthDialog();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState('#discover');
  const lastY = useRef(0);
  const directionDistance = useRef(0);
  const lastDirection = useRef(0);
  const lastToggle = useRef(0);
  const scrollFrame = useRef<number | null>(null);
  useEffect(() => {
    const onScroll = () => {
      if (scrollFrame.current !== null) return;
      scrollFrame.current = requestAnimationFrame(() => {
        const y = Math.max(0, window.scrollY);
        const delta = y - lastY.current;
        const direction = Math.sign(delta);
        if (direction && direction !== lastDirection.current) directionDistance.current = 0;
        if (direction) lastDirection.current = direction;
        directionDistance.current += delta;
        const canToggle = performance.now() - lastToggle.current > 450;
        if (y < 100) {
          setHidden(false);
          directionDistance.current = 0;
        } else if (canToggle && y > 180 && directionDistance.current > 110) {
          setHidden(true);
          directionDistance.current = 0;
          lastToggle.current = performance.now();
        } else if (canToggle && directionDistance.current < -65) {
          setHidden(false);
          directionDistance.current = 0;
          lastToggle.current = performance.now();
        }
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
    <header className={ui(hidden && !open ? 'home-navbar nav-hidden' : 'home-navbar nav-visible')}>
      <nav className={ui('home-nav')} aria-label="Main navigation">
        <Link
          to="/"
          className={ui('brand-lockup home-brand')}
          onClick={(e) => {
            if (location.pathname === '/') e.preventDefault();
            scrollToTop();
          }}
        >
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
            <Link
              key={link.href}
              to={`/${link.href}`}
              aria-current={active === link.href ? 'location' : undefined}
              onClick={() => setActive(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className={ui('home-nav-actions')}>
          <Link className={ui('nav-search')} to="/#discover" aria-label="Search events">
            <Search size={19} />
          </Link>
          <ThemePicker />
          <button type="button" className={ui('nav-tickets')} onClick={() => openAuth('tickets')}>
            <Ticket size={17} /> My Tickets
          </button>
          <button
            type="button"
            className={ui('nav-create home-cta')}
            onClick={() => openAuth('organizer')}
          >
            Create event <ArrowUpRight size={16} />
          </button>
          <button type="button" className="auth-header-login" onClick={() => openAuth('login')}>
            <UserRound size={16} /> Đăng nhập
          </button>
          <button
            type="button"
            className="auth-header-register"
            onClick={() => openAuth('register')}
          >
            Đăng ký
          </button>
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
          <Link
            key={link.href}
            to={`/${link.href}`}
            tabIndex={open ? 0 : -1}
            aria-current={active === link.href ? 'location' : undefined}
            onClick={() => {
              setActive(link.href);
              setOpen(false);
            }}
          >
            {link.label}
          </Link>
        ))}
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setOpen(false);
            openAuth('tickets');
          }}
        >
          My Tickets
        </button>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setOpen(false);
            openAuth('organizer');
          }}
        >
          Create event
        </button>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setOpen(false);
            openAuth('login');
          }}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onClick={() => {
            setOpen(false);
            openAuth('register');
          }}
        >
          Đăng ký
        </button>
      </div>
    </header>
  );
}
