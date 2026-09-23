import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { useAuthDialog } from '../../../features/auth/context/AuthDialogContext';
import { useScrollReveal } from '../../../shared/motion/useScrollReveal';

const footerGroups = [
  {
    title: 'Explore',
    links: [
      { label: 'Trending events', to: '/#featured' },
      { label: 'Browse all events', to: '/#discover' },
      { label: 'Browse by location', to: '/#locations' },
      { label: 'Resale tickets', to: '/#resale' },
    ],
  },
  {
    title: 'Discover more',
    links: [
      { label: 'Featured organizers', to: '/#stars' },
      { label: 'The Spotlight', to: '/#spotlight' },
      { label: 'Merchandise', to: '/#merchandise' },
      { label: 'Blog & insights', to: '/#blog' },
    ],
  },
];

export default function Footer() {
  const { openAuth } = useAuthDialog();
  const revealRoot = useScrollReveal();
  return (
    <footer className="home-footer relative overflow-hidden text-white">
      <div aria-hidden="true" className="footer-glow pointer-events-none absolute inset-0" />
      <div ref={revealRoot} className="relative mx-auto max-w-7xl px-4 pb-24 pt-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 border-b border-white/15 pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-3 text-xl font-extrabold tracking-tight text-white"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500 text-white">
                <Ticket size={21} />
              </span>
              Eventix
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-7 text-slate-300">
              Discover events, find your people, and make every night a story worth keeping.
            </p>
          </div>
          {footerGroups.map((group) => (
            <div data-reveal key={group.title}>
              <h3 className="mb-5 text-sm font-extrabold text-white">{group.title}</h3>
              <ul className="space-y-3.5">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="footer-link inline-flex items-center gap-2 text-sm text-slate-300"
                    >
                      <span aria-hidden="true" className="footer-link-mark" />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div data-reveal>
            <h3 className="mb-5 text-sm font-extrabold text-white">Account & support</h3>
            <ul className="space-y-3.5">
              <li>
                <button
                  type="button"
                  className="footer-link inline-flex items-center gap-2 text-sm text-slate-300"
                  onClick={() => openAuth('tickets')}
                >
                  <span aria-hidden="true" className="footer-link-mark" />
                  My Tickets
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link inline-flex items-center gap-2 text-sm text-slate-300"
                  onClick={() => openAuth('login')}
                >
                  <span aria-hidden="true" className="footer-link-mark" />
                  Đăng nhập
                </button>
              </li>
              <li>
                <button
                  type="button"
                  className="footer-link inline-flex items-center gap-2 text-sm text-slate-300"
                  onClick={() => openAuth('register')}
                >
                  <span aria-hidden="true" className="footer-link-mark" />
                  Đăng ký
                </button>
              </li>
              <li>
                <Link
                  to="/guide"
                  className="footer-link inline-flex items-center gap-2 text-sm text-slate-300"
                >
                  <span aria-hidden="true" className="footer-link-mark" />
                  Help & guides
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col justify-between gap-2 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center">
          <span>© 2026 Eventix. Made for memorable moments.</span>
          <span>Preview experience · Account access and ticket sales are coming soon.</span>
        </div>
      </div>
    </footer>
  );
}
