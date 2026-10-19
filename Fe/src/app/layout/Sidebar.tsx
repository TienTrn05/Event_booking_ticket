import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, type To } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCheck,
  ClipboardList,
  Compass,
  Drama,
  LayoutDashboard,
  LogOut,
  Menu,
  Music2,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trees,
  Trophy,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Brand } from '../../shared/ui/Brand';
import { LanguagePicker } from '../../shared/i18n/LanguagePicker';
import { useLocale } from '../../shared/i18n/LocaleContext';
import { ThemePicker } from '../../shared/theme/ThemePicker';
import { useAuthDialog } from '../../features/auth/context/AuthDialogContext';
import { OrbInput } from '../../components/ui/animated-input';
import { ExpressiveIcon } from '../../shared/ui/ExpressiveIcon';

const categories = [
  { vi: 'Nhạc sống', en: 'Live music', code: 'music', icon: Music2 },
  { vi: 'Thể thao', en: 'Sports', code: 'sports', icon: Trophy },
  { vi: 'Sân khấu & Nghệ thuật', en: 'Stage & Arts', code: 'arts', icon: Drama },
  { vi: 'Hội thảo & Workshop', en: 'Talks & Workshops', code: 'workshops', icon: Users },
  { vi: 'Tham quan & Trải nghiệm', en: 'Tours & Experiences', code: 'festivals', icon: Trees },
  { vi: 'Khác', en: 'Other', code: 'technology', icon: Sparkles },
] as const;

interface NavigationItem {
  to: To;
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

function SidebarContent({
  close,
  desktop = false,
  expanded = true,
  focusSearch,
}: {
  close: () => void;
  desktop?: boolean;
  expanded?: boolean;
  // toggle?: () => void;
  focusSearch?: () => void;
}) {
  const collapsed = desktop && !expanded;
  const { t } = useLocale();
  const { user, openAuth, logout } = useAuthDialog();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const admin = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const organizer =
    location.pathname === '/organizer' || location.pathname.startsWith('/organizer/');
  const workspace = admin || organizer;
  const home = location.pathname === '/';
  const searchId = useId();

  const openAccount = () => {
    close();
    openAuth(user ? 'account' : 'login');
  };
  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(new FormData(event.currentTarget).get('q') ?? '').trim();
    close();
    window.scrollTo({ top: 0, behavior: 'instant' });
    void navigate(`/events?${new URLSearchParams(query ? { q: query } : {})}`);
  };
  const links: NavigationItem[] = admin
    ? [
        {
          to: '/admin',
          label: t('Hồ sơ chờ duyệt', 'Review queue'),
          icon: ClipboardList,
          active: location.pathname === '/admin',
        },
        {
          to: '/admin/rbac',
          label: t('Vai trò & phân quyền', 'Roles & permissions'),
          icon: ShieldCheck,
        },
        {
          to: '/admin/onboarding',
          label: t('Câu hỏi đăng ký', 'Onboarding questions'),
          icon: Users,
        },
      ]
    : organizer
      ? [
          {
            to: '/organizer',
            label: t('Tổ chức & sự kiện', 'Organizations & events'),
            icon: CalendarDays,
            active: !location.pathname.includes('check-in'),
          },
          {
            to: '/organizer/check-in',
            label: t('Check-in & vào cửa', 'Check-in & admission'),
            icon: CheckCheck,
          },
        ]
      : [
          {
            to: '/',
            label: t('Khám phá', 'Discover'),
            icon: Compass,
            active: home || (location.pathname === '/events' && !params.has('category')),
          },
          { to: '/my-tickets', label: t('Vé của tôi', 'My tickets'), icon: Ticket },
          { to: '/my-orders', label: t('Đơn hàng của tôi', 'My orders'), icon: Package },
        ];
  const renderLink = ({ to, label, icon: Icon, active }: NavigationItem) => {
    const selected = active ?? location.pathname === to;
    const target =
      typeof to === 'string' ? to : `${to.pathname ?? ''}${to.search ?? ''}${to.hash ?? ''}`;
    const icon = (
      <ExpressiveIcon
        icon={Icon}
        tone={
          Icon === Music2 || Icon === Drama
            ? 'violet'
            : Icon === Trophy || Icon === Package
              ? 'amber'
              : Icon === Trees || Icon === Users
                ? 'green'
                : Icon === Ticket
                  ? 'coral'
                  : 'blue'
        }
      />
    );
    return (
      <Link
        key={target}
        to={to}
        onClick={() => {
          close();
          window.scrollTo({ top: 0, behavior: 'instant' });
        }}
        aria-current={selected ? 'page' : undefined}
        aria-label={label}
        title={collapsed ? label : undefined}
        className="sidebar-link"
      >
        {icon}
        <span className="sidebar-label">{label}</span>
      </Link>
    );
  };

  return (
    <div data-compact={collapsed} className="sidebar-content flex h-full min-h-0 flex-col">
      <div className="sidebar-brand flex min-h-24 shrink-0 items-center justify-between gap-2 px-5">
        <Brand />
        {!desktop && (
          <button
            type="button"
            onClick={close}
            aria-label={t('Đóng menu', 'Close menu')}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl hover:bg-raised"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="sidebar-search-row relative shrink-0">
        {desktop && (
          <button
            type="button"
            aria-controls="desktop-sidebar"
            aria-expanded={expanded}
            onClick={focusSearch}
            tabIndex={collapsed ? 0 : -1}
            aria-hidden={!collapsed}
            className="sidebar-search-shortcut"
            aria-label={t('Tìm sự kiện', 'Search events')}
            title={t('Tìm sự kiện', 'Search events')}
          >
            <ExpressiveIcon icon={Search} />
          </button>
        )}
        <form
          role="search"
          onSubmit={search}
          inert={collapsed}
          aria-hidden={collapsed}
          className="sidebar-search-form mx-4 mb-4 shrink-0"
        >
          <label htmlFor={searchId} className="sr-only">
            {t('Tìm sự kiện', 'Search events')}
          </label>
          <OrbInput
            id={searchId}
            name="q"
            type="search"
            maxLength={120}
            disabled={collapsed}
            key={location.search}
            defaultValue={params.get('q') ?? ''}
            aria-label={t('Tìm sự kiện', 'Search events')}
            compact
            placeholders={[
              t('Tìm sự kiện…', 'Search events…'),
              t('Tìm địa điểm…', 'Find a venue…'),
              t('Tìm nhà tổ chức…', 'Find an organizer…'),
            ]}
            endAdornment={
              <button
                type="submit"
                aria-label={t('Tìm', 'Find')}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-accent"
              >
                <Search size={18} />
              </button>
            }
          />
        </form>
      </div>
      <nav
        aria-label={t('Điều hướng chính', 'Main navigation')}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-4 no-scrollbar"
      >
        <p className="sidebar-group-label" aria-hidden={collapsed}>
          {admin
            ? t('Quản trị', 'Administration')
            : organizer
              ? t('Nhà tổ chức', 'Organizer')
              : t('Dành cho bạn', 'For you')}
        </p>
        <div className="grid gap-1">{links.map(renderLink)}</div>
        {!workspace && (
          <>
            <p className="sidebar-group-label mt-5" aria-hidden={collapsed}>
              {t('Danh mục sự kiện', 'Event categories')}
            </p>
            <div className="grid gap-1">
              {categories.map(({ vi, en, code, icon }) =>
                renderLink({
                  to: `/events?category=${code}`,
                  label: t(vi, en),
                  icon,
                  active: location.pathname === '/events' && params.get('category') === code,
                }),
              )}
              {renderLink({
                to: '/reopening',
                label: t('Vé bán lại', 'Reopened sales'),
                icon: Ticket,
              })}
              {renderLink({ to: '/blog', label: 'Blog', icon: BookOpen })}
            </div>
          </>
        )}
        <div className="mt-5 grid gap-1 border-t border-[var(--sidebar-line)] pt-4">
          {workspace &&
            renderLink({
              to: '/',
              label: t('Về trang khám phá', 'Back to discovery'),
              icon: ArrowLeft,
            })}
          {renderLink({
            to: admin ? '/organizer' : '/admin',
            label: admin
              ? t('Không gian tổ chức', 'Organizer workspace')
              : t('Khu vực quản trị', 'Administration'),
            icon: LayoutDashboard,
            active: false,
          })}
          {!workspace &&
            renderLink({
              to: '/organizer',
              label: t('Không gian tổ chức', 'Organizer workspace'),
              icon: CalendarDays,
            })}
          {renderLink({
            to: '/guide',
            label: t('Hướng dẫn đặt vé', 'Booking guide'),
            icon: BookOpen,
          })}
        </div>
      </nav>
      <div className="sidebar-preferences shrink-0 border-t border-[var(--sidebar-line)] p-4">
        {!workspace && (
          <Link
            to="/organizer"
            onClick={close}
            aria-label={t('Tạo sự kiện', 'Create event')}
            className="sidebar-create mb-3 flex min-h-11 items-center gap-2 rounded-full bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
          >
            <ExpressiveIcon icon={CalendarDays} />
            <span className="sidebar-label">{t('Tạo sự kiện', 'Create event')}</span>
            <ArrowUpRight size={17} className="sidebar-label" />
          </Link>
        )}
        <div className="sidebar-picker-row mb-3 flex items-center gap-2">
          <ThemePicker />
          <LanguagePicker />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={openAccount}
            aria-label={user?.displayName ?? t('Đăng nhập', 'Sign in')}
            title={collapsed ? (user?.displayName ?? t('Đăng nhập', 'Sign in')) : undefined}
            className="sidebar-link min-w-0 flex-1"
          >
            <ExpressiveIcon icon={UserRound} tone="violet" />
            <span className="sidebar-label truncate">
              {user?.displayName ?? t('Đăng nhập', 'Sign in')}
            </span>
          </button>
          {user && (
            <button
              type="button"
              aria-label={t('Đăng xuất', 'Sign out')}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-raised"
              onClick={() => {
                close();
                void logout();
              }}
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { t } = useLocale();
  const location = useLocation();
  const drawer = useRef<HTMLDialogElement>(null);
  const desktop = useRef<HTMLElement>(null);
  const hover = useRef(false);
  const keyboard = useRef(false);
  const suppressFocus = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchFrame = useRef(0);
  const previousOverflow = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [desktopState, setDesktopState] = useState({ key: location.key, open: false });
  const desktopOpen = desktopState.key === location.key && desktopState.open;
  const clearLeave = () => {
    if (leaveTimer.current !== null) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  const expand = () => {
    clearLeave();
    setDesktopState({ key: location.key, open: true });
  };
  const collapse = () => {
    clearLeave();
    setDesktopState((previous) => ({ ...previous, open: false }));
  };
  const deferCollapse = () => {
    clearLeave();
    leaveTimer.current = setTimeout(() => {
      const element = desktop.current;
      const editing = element?.querySelector(
        'input:focus, textarea:focus, select:focus, [role=menu]',
      );
      if (
        !hover.current &&
        !editing &&
        !(keyboard.current && element?.contains(document.activeElement))
      )
        setDesktopState((previous) => ({ ...previous, open: false }));
    }, 160);
  };
  const unlockScroll = () => {
    if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current;
    previousOverflow.current = null;
  };
  const close = () => {
    // Release this lock before a following action opens another dialog (for example sign-in).
    unlockScroll();
    drawer.current?.close();
    collapse();
  };
  useEffect(() => {
    drawer.current?.close();
  }, [location.key]);
  useEffect(() => {
    if (!desktopOpen) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !desktop.current?.contains(event.target))
        setDesktopState((previous) => ({ ...previous, open: false }));
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [desktopOpen]);
  useEffect(() => {
    const breakpoint = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      drawer.current?.close();
      setDesktopState((previous) => ({ ...previous, open: false }));
    };
    breakpoint.addEventListener('change', update);
    return () => {
      breakpoint.removeEventListener('change', update);
      clearLeave();
      cancelAnimationFrame(searchFrame.current);
      unlockScroll();
    };
  }, []);
  return (
    <>
      <aside
        ref={desktop}
        id="desktop-sidebar"
        data-expanded={desktopOpen}
        aria-label={t('Thanh điều hướng', 'Sidebar')}
        className="desktop-sidebar app-sidebar fixed inset-y-0 left-0 z-40 hidden border-r border-[var(--sidebar-line)] lg:block"
        onPointerEnter={(event) => {
          if (event.pointerType !== 'touch') {
            hover.current = true;
            keyboard.current = false;
            expand();
          }
        }}
        onPointerLeave={() => {
          hover.current = false;
          deferCollapse();
        }}
        onPointerDownCapture={() => {
          keyboard.current = false;
        }}
        onFocusCapture={(event) => {
          if (suppressFocus.current) {
            suppressFocus.current = false;
            return;
          }
          if (event.target.matches(':focus-visible')) expand();
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget) && !hover.current) {
            keyboard.current = false;
            deferCollapse();
          }
        }}
        onKeyDownCapture={(event) => {
          keyboard.current = true;
          if (event.key === 'Escape' && !event.currentTarget.querySelector('[role=menu]')) {
            event.preventDefault();
            collapse();
            suppressFocus.current = true;
            event.currentTarget.querySelector<HTMLButtonElement>('.sidebar-menu-trigger')?.focus();
          }
        }}
      >
        <SidebarContent
          close={close}
          desktop
          expanded={desktopOpen}
          // toggle={() => (desktopOpen ? collapse() : expand())}
          focusSearch={() => {
            expand();
            cancelAnimationFrame(searchFrame.current);
            searchFrame.current = requestAnimationFrame(() =>
              desktop.current?.querySelector<HTMLInputElement>('input[name=q]')?.focus(),
            );
          }}
        />
      </aside>
      <div className="sticky top-0 z-40 flex min-h-16 items-center gap-3 border-b border-line bg-[var(--sidebar)] px-4 lg:hidden">
        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-xl border border-line"
          aria-label={t('Mở menu', 'Open menu')}
          aria-controls="mobile-sidebar"
          aria-expanded={open}
          onClick={() => {
            if (!drawer.current) return;
            previousOverflow.current = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            drawer.current.showModal();
            setOpen(true);
          }}
        >
          <Menu size={20} />
        </button>
        <Brand />
      </div>
      <dialog
        ref={drawer}
        id="mobile-sidebar"
        aria-label={t('Điều hướng', 'Navigation')}
        className="sidebar-drawer app-sidebar"
        onClose={() => {
          unlockScroll();
          setOpen(false);
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.target === event.currentTarget &&
            (event.clientX > rect.right ||
              event.clientX < rect.left ||
              event.clientY < rect.top ||
              event.clientY > rect.bottom)
          )
            close();
        }}
      >
        <SidebarContent close={close} />
      </dialog>
    </>
  );
}
