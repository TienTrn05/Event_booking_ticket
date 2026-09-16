import { ui } from '../../../shared/styles/classes';
import { Ticket, Instagram, Facebook, Youtube, Twitter } from 'lucide-react';

const footerSections = [
  {
    title: 'Discover',
    links: ['Trending Events', 'Music', 'Technology', 'Sports', 'Arts & Culture', 'Festivals'],
  },
  {
    title: 'Platform',
    links: ['For Organizers', 'Pricing', 'Seat Mapping', 'Analytics', 'API Docs', 'Integrations'],
  },
  {
    title: 'Company',
    links: ['About Us', 'Careers', 'Press Kit', 'Blog', 'Contact', 'Partners'],
  },
  {
    title: 'Support',
    links: [
      'Help Center',
      'Refund Policy',
      'Terms of Service',
      'Privacy Policy',
      'Cookie Settings',
      'Report an Issue',
    ],
  },
];

const socialIcons = [Instagram, Facebook, Youtube, Twitter];

export default function Footer() {
  return (
    <footer className="bg-ink-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className={ui('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 mb-12')}>
          {/* Brand */}
          <div className="col-span-2" data-reveal>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <span className={ui('text-lg font-extrabold tracking-tight')}>Eventix</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs mb-6">
              The modern ticketing platform for discovering and creating unforgettable live
              experiences.
            </p>
            <div className="flex gap-3">
              {socialIcons.map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-lg bg-white/5 hover:bg-primary-600 flex items-center justify-center transition-colors"
                  aria-label="Social link"
                >
                  <Icon size={18} className="text-white/70" />
                </a>
              ))}
            </div>
          </div>

          {/* Link sections */}
          {footerSections.map((section) => (
            <div key={section.title} data-reveal>
              <h4 className="text-sm font-bold text-white mb-4">{section.title}</h4>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className={ui(
            'pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4',
          )}
        >
          <p className="text-sm text-white/50">© 2026 Eventix. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm text-white/50 hover:text-white transition-colors">
              Terms
            </a>
            <a href="#" className="text-sm text-white/50 hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="text-sm text-white/50 hover:text-white transition-colors">
              Cookies
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
