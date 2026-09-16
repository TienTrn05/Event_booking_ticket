import { ui } from '../shared/styles/classes';
import { Outlet } from 'react-router-dom';
import { Navbar } from './layout/Navbar';
import { Footer } from './layout/Footer';
export function SiteLayout() {
  return (
    <div className={ui('legacy-site')}>
      <a className={ui('skip-link')} href="#main">
        Đến nội dung chính
      </a>
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
