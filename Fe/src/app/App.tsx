import { ui } from '../shared/styles/classes';
import { useEffect } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './layout/home/Navbar';
import { ExploreEvents } from '../features/events/components/home/ReopeningEvents';
import { HomePage } from '../features/events/pages/HomePage';
import { EventDetailPage } from '../features/events/pages/EventDetailPage';
import { BlogPage, InfoPage } from '../features/content/pages/InfoPage';
import { SiteLayout } from './SiteLayout';
import { ProductPage } from '../features/merchandise/pages/ProductPage';
import { scrollToHash } from '../shared/motion/scroll';
export function App() {
  const { pathname, hash, search } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const followHashLink = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
          : null;
      const nextHash = link?.hash;
      if (!nextHash || nextHash === '#' || !document.getElementById(nextHash.slice(1))) return;
      event.preventDefault();
      if (nextHash === hash) {
        scrollToHash(nextHash);
        return;
      }
      void navigate({ pathname, search, hash: nextHash });
    };
    document.addEventListener('click', followHashLink);
    return () => document.removeEventListener('click', followHashLink);
  }, [hash, navigate, pathname, search]);
  useEffect(() => {
    if (hash) scrollToHash(hash);
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash, search]);
  return (
    <Routes>
      <Route
        path="/"
        element={
          <div
            className={ui('reference-site min-h-screen bg-ink-50 transition-colors duration-300')}
          >
            <Navbar />
            <HomePage />
          </div>
        }
      />
      <Route element={<SiteLayout />}>
        <Route
          path="/reopening"
          element={
            <main id="main" className={ui('container content-page')}>
              <h1>Vé bán lại từ nhà tổ chức</h1>
              <ExploreEvents reopening />
            </main>
          }
        />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/merchandise/:productId" element={<ProductPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:articleId" element={<BlogPage />} />
        <Route path="/login" element={<InfoPage kind="login" />} />
        <Route path="/organizer" element={<InfoPage kind="organizer" />} />
        <Route path="/my-tickets" element={<InfoPage kind="tickets" />} />
        <Route path="/guide" element={<InfoPage kind="guide" />} />
        <Route path="*" element={<InfoPage kind="not-found" />} />
      </Route>
    </Routes>
  );
}
