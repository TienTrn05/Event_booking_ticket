import { Link } from 'react-router-dom';
import {
  ArrowUp,
  ArrowUpRight,
  Clock3,
  Compass,
  Facebook,
  Github,
  Instagram,
  Mail,
  MapPin,
  Phone,
  Ticket,
} from 'lucide-react';
import { FooterBackgroundGradient, FooterWordmark } from '../../../components/ui/footer-artwork';
import { Brand } from '../../../shared/ui/Brand';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { scrollToTop } from '../../../shared/motion/scroll';

const contact = {
  quote: 'Beyond the ticket. Into the moment.',
  email: 'ngoctien20022005@gmail.com',
  phone: '0935572707',
  phoneHref: 'tel:+84935572707',
};

const socialLinks = [
  { label: 'Facebook', href: 'https://www.facebook.com/nin.tran0205', icon: Facebook },
  { label: 'GitHub', href: 'https://github.com/TienTrn05', icon: Github },
  { label: 'Instagram', href: 'https://www.instagram.com/ny_nne/', icon: Instagram },
];

export default function Footer() {
  const { t } = useLocale();
  function returnToTop() {
    [...document.querySelectorAll<HTMLAnchorElement>('[data-brand-home]')]
      .find((link) => link.getClientRects().length > 0)
      ?.focus({ preventScroll: true });
    // Let keyboard activation finish before starting a cancellable scroll.
    requestAnimationFrame(scrollToTop);
  }
  const linkGroups = [
    {
      title: t('Khám phá', 'Explore'),
      icon: Compass,
      links: [
        { to: '/events', label: t('Tìm sự kiện', 'Find events') },
        { to: '/reopening', label: t('Vé mở bán lại', 'Reopened tickets') },
        { to: '/blog', label: t('Câu chuyện & cảm hứng', 'Stories & inspiration') },
      ],
    },
    {
      title: t('Hành trình của bạn', 'Your journey'),
      icon: Ticket,
      links: [
        { to: '/my-tickets', label: t('Vé của tôi', 'My tickets') },
        { to: '/my-orders', label: t('Đơn hàng của tôi', 'My orders') },
        { to: '/guide', label: t('Hướng dẫn đặt vé', 'Booking guide') },
        { to: '/organizer', label: t('Bắt đầu tổ chức', 'Start organizing') },
      ],
    },
  ];

  return (
    <footer className="eventix-footer w-full text-foreground">
      <div className="relative isolate overflow-hidden border-t border-line bg-surface">
        <FooterBackgroundGradient />
        <div className="mx-auto max-w-[1240px] px-5 pt-9 sm:px-8 sm:pt-12 lg:px-10">
          <div className="flex flex-col gap-9 lg:flex-row lg:gap-12">
            <div className="min-w-0 lg:w-[28%] lg:shrink-0">
              <Brand />
              <blockquote
                lang="en"
                className="mt-5 max-w-sm text-xl font-semibold leading-relaxed tracking-tight"
              >
                {contact.quote}
              </blockquote>
              <nav aria-label={t('Trang cá nhân', 'Social profiles')} className="mt-5">
                <ul className="flex flex-wrap gap-2">
                  {socialLinks.map(({ label, href, icon: Icon }) => (
                    <li key={label}>
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t(
                          `${label} (mở trong thẻ mới)`,
                          `${label} (opens in a new tab)`,
                        )}
                        className="hover-footer-link inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-accent-soft"
                      >
                        <Icon size={19} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <nav
              aria-label={t('Liên kết cuối trang', 'Footer navigation')}
              className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-7 sm:gap-x-12 lg:gap-x-8"
            >
              {linkGroups.map(({ title, icon: Icon, links }) => (
                <div key={title} className="min-w-[105px] flex-1">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                    <Icon size={16} className="text-accent" aria-hidden="true" />
                    {title}
                  </h2>
                  <ul>
                    {links.map(({ to, label }) => (
                      <li key={to}>
                        <Link
                          to={to}
                          className="hover-footer-link inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-muted"
                        >
                          {label}
                          {to === '/organizer' && <ArrowUpRight size={16} aria-hidden="true" />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="min-w-0 lg:w-[29%] lg:shrink-0">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Mail size={16} className="text-accent" aria-hidden="true" />
                {t('Liên hệ', 'Contact')}
              </h2>
              <address className="text-sm not-italic leading-6 text-muted">
                <ul>
                  <li>
                    <a
                      href={`mailto:${contact.email}`}
                      className="hover-footer-link flex min-h-11 items-center gap-3 rounded-lg py-2"
                    >
                      <Mail size={17} className="shrink-0 text-accent" aria-hidden="true" />
                      <span className="min-w-0 break-all">{contact.email}</span>
                    </a>
                  </li>
                  <li>
                    <a
                      href={contact.phoneHref}
                      className="hover-footer-link flex min-h-11 items-center gap-3 rounded-lg py-2"
                    >
                      <Phone size={17} className="shrink-0 text-accent" aria-hidden="true" />
                      {contact.phone}
                    </a>
                  </li>
                  <li className="flex min-h-11 items-center gap-3 py-2">
                    <MapPin size={17} className="shrink-0 text-accent" aria-hidden="true" />
                    {t('Liên Chiểu, Đà Nẵng', 'Lien Chieu District, Da Nang')}
                  </li>
                </ul>
              </address>
              <p className="flex min-h-11 items-center gap-3 py-2 text-sm leading-6 text-muted">
                <Clock3 size={17} className="shrink-0 text-accent" aria-hidden="true" />
                <span>
                  <span className="sr-only">{t('Giờ liên hệ: ', 'Contact hours: ')}</span>
                  <time dateTime="08:00">{t('08:00', '8:00 AM')}</time>
                  {' – '}
                  <time dateTime="17:00">{t('17:00', '5:00 PM')}</time>
                </span>
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line pt-5 text-xs text-muted sm:mt-10">
            <p>
              © {new Date().getFullYear()} Eventix.{' '}
              {t('Mọi quyền được bảo lưu.', 'All rights reserved.')}
            </p>
            <button
              type="button"
              onClick={returnToTop}
              className="hover-footer-link inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold"
            >
              {t('Về đầu trang', 'Back to top')}
              <ArrowUp size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="mx-auto max-w-[1320px] px-3 pb-2 pt-3 sm:px-5 sm:pb-4">
          <FooterWordmark text="EVENTIX" />
        </div>
      </div>
    </footer>
  );
}
