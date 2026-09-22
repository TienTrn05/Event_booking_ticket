import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Ticket, Menu, X, ChevronDown, User, Settings, LogOut, ShoppingBag } from 'lucide-react';
import Button from '@/components/ui/Button';
import Avatar from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import { ThemePicker } from '@/components/ui/ThemePicker';

const navLinks = [
  { label: 'Discover', href: '#discover' },
  { label: 'Categories', href: '#categories' },
  { label: 'Merchandise', href: '#merchandise', icon: ShoppingBag },
  { label: 'For Organizers', href: '#organizers' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [visible, setVisible] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 8);
      if (currentScrollY < 80 || currentScrollY < lastScrollY.current) setVisible(true);
      else if (currentScrollY > lastScrollY.current) setVisible(false);
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const lightText = !scrolled;

  return (
    <header className={`navbar-shell ${scrolled ? 'navbar-solid' : ''} fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${visible ? 'translate-y-0' : '-translate-y-full'} ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-ink-100' : 'bg-ink-900/20 backdrop-blur-[2px]'}`}>
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="brand-lockup flex items-center gap-3 flex-shrink-0">
            <span className="brand-mark" aria-hidden="true">
              <Ticket className="w-5 h-5" strokeWidth={2.4} />
              <span className="brand-mark-dot" />
            </span>
            <span className="flex flex-col leading-none">
              <span className={`text-lg font-extrabold tracking-tight ${lightText ? 'text-white' : 'text-ink-900'}`}>Eventix</span>
              <span className={`hidden sm:block mt-1 text-[9px] font-bold uppercase tracking-[0.22em] ${lightText ? 'text-white/55' : 'text-primary-600'}`}>Make it memorable</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a key={link.label} href={link.href} className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${lightText ? 'text-white/85 hover:text-white hover:bg-white/10' : 'text-ink-600 hover:text-ink-900 hover:bg-ink-100'}`}>
                  {Icon && <Icon size={14} />}
                  {link.label}
                </a>
              );
            })}
          </div>

          <div className="hidden lg:flex items-center flex-1 max-w-xs mx-4">
            <div className="relative w-full">
              <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${lightText ? 'text-ink-500' : 'text-ink-400'}`} size={16} />
              <input type="text" placeholder="Search event, artist or venue" className="w-full h-10 pl-10 pr-4 text-sm rounded-lg border border-white/20 bg-white/95 text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100 transition-all" />
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <ThemePicker />
            <Button variant="ghost" size="sm" className={lightText ? 'text-white hover:bg-white/10 hover:text-white' : ''}>Create Event</Button>
            <Button variant="outline" size="sm" className={lightText ? 'border-white/50 text-white hover:bg-white/10 hover:border-white' : ''}>
              <Ticket size={16} /> My Tickets
            </Button>
            <Dropdown trigger={<button className={`flex items-center gap-1.5 p-1 pr-2 rounded-lg transition-colors ${lightText ? 'hover:bg-white/10' : 'hover:bg-ink-100'}`}><Avatar alt="Minh Nguyen" size="sm" /><ChevronDown size={16} className={lightText ? 'text-white/70' : 'text-ink-400'} /></button>} items={[{ label: 'My Profile', icon: <User size={16} /> }, { label: 'Account settings', icon: <Settings size={16} /> }, { label: 'Sign out', icon: <LogOut size={16} /> }]} />
          </div>

          <button onClick={() => setMobileOpen((prev) => !prev)} className={`md:hidden p-2 -mr-2 ${lightText ? 'text-white' : 'text-ink-700'}`} aria-label="Toggle menu">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {mobileOpen && (
          <div className={`md:hidden py-4 border-t animate-fade-in ${lightText ? 'border-white/15' : 'border-ink-100'}`}>
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
              <input type="text" placeholder="Search event, artist or venue" className="w-full h-11 pl-10 pr-4 text-sm rounded-xl border border-ink-200 bg-white text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100" />
            </div>
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => <a key={link.label} href={link.href} onClick={() => setMobileOpen(false)} className={`px-4 py-3 text-sm font-semibold rounded-lg transition-colors ${lightText ? 'text-white hover:bg-white/10' : 'text-ink-700 hover:bg-ink-100'}`}>{link.label}</a>)}
              <div className={`flex flex-col gap-2 pt-3 mt-2 border-t ${lightText ? 'border-white/15' : 'border-ink-100'}`}>
                <ThemePicker />
                <Button variant="primary" size="md" className="w-full">Create Event</Button>
                <Button variant="outline" size="md" className="w-full"><Ticket size={16} /> My Tickets</Button>
                <Button variant="ghost" size="md" className="w-full"><Avatar alt="Minh Nguyen" size="sm" /> Sign in</Button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
