import { ui } from '../../shared/styles/classes';
import { useState } from 'react';
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom';
import { categories } from '../../features/events/data/discovery';
import { ThemePicker } from '../../shared/theme/ThemePicker';
import { Icon } from '../../shared/ui/Icon';
export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  return (
    <header className={ui(`site-header ${pathname === '/' ? 'home-header' : ''}`)}>
      <div className={ui('container header-main')}>
        <Link to="/" className={ui('brand')} aria-label="Event Ticketing — Trang chủ">
          <span className={ui('brand-mark')}>
            <Icon name="ticket" />
          </span>
          <span>
            event<span className={ui('brand-light')}>ticketing</span>
            <span className={ui('brand-dot')}>.</span>
          </span>
        </Link>
        <div className={ui('header-site-links')}>
          <Link to="/#discover">Khám phá</Link>
          <Link to="/#categories">Danh mục</Link>
        </div>
        <form className={ui('header-search')} action="/" role="search">
          <Icon name="search" />
          <input
            name="q"
            aria-label="Tìm sự kiện"
            placeholder="Bạn muốn trải nghiệm điều gì?"
            defaultValue={params.get('q') ?? ''}
            key={params.get('q')}
          />
          <button type="submit" aria-label="Tìm kiếm">
            <Icon name="arrow" />
          </button>
        </form>
        <div className={ui('header-actions')}>
          <ThemePicker />
          <Link className={ui('create-link')} to="/organizer">
            Tạo sự kiện ↗
          </Link>
          <Link className={ui('tickets-link')} to="/my-tickets">
            <Icon name="ticket" />
            <span>Vé của tôi</span>
          </Link>
          <Link to="/login" className={ui('button button-small')}>
            Đăng nhập
          </Link>
        </div>
        <button
          className={ui('icon-button mobile-menu-button')}
          aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
      </div>
      <nav
        id="main-nav"
        className={ui(`category-nav ${menuOpen ? 'is-open' : ''}`)}
        aria-label="Danh mục sự kiện"
      >
        <div className={ui('container nav-inner')}>
          {categories.map((category) => (
            <Link
              key={category.id}
              className={ui(params.get('category') === category.id ? 'nav-active' : '')}
              to={`/?category=${category.id}#discover`}
              onClick={() => setMenuOpen(false)}
            >
              {category.label}
            </Link>
          ))}
          <span className={ui('nav-divider')} />
          <NavLink to="/reopening" onClick={() => setMenuOpen(false)}>
            Vé bán lại
          </NavLink>
          <NavLink to="/blog" onClick={() => setMenuOpen(false)}>
            Blog
          </NavLink>
          <div className={ui('mobile-nav-actions')}>
            <Link to="/organizer" onClick={() => setMenuOpen(false)}>
              Tạo sự kiện
            </Link>
            <Link to="/my-tickets" onClick={() => setMenuOpen(false)}>
              Vé của tôi
            </Link>
            <Link to="/login" onClick={() => setMenuOpen(false)}>
              Đăng nhập
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
