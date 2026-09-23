import { Navigate, Route, Routes } from 'react-router-dom';
import type { AuthIntent } from '../features/auth/context/AuthDialogContext';
import { BlogPage } from '../features/content/pages/BlogPage';
import { InfoPage } from '../features/content/pages/InfoPage';
import { EventDetailPage } from '../features/events/pages/EventDetailPage';
import { HomePage } from '../features/events/pages/HomePage';
import { ReopeningPage } from '../features/events/pages/ReopeningPage';
import { ProductPage } from '../features/merchandise/pages/ProductPage';
import { AppShell } from './layout/AppShell';
import { SiteLayout } from './SiteLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthRedirect intent="login" />} />
        <Route path="/register" element={<AuthRedirect intent="register" />} />
        <Route path="/organizer" element={<AuthRedirect intent="organizer" />} />
        <Route path="/my-tickets" element={<AuthRedirect intent="tickets" />} />
        <Route element={<SiteLayout />}>
          <Route path="/reopening" element={<ReopeningPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/merchandise/:productId" element={<ProductPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:articleId" element={<BlogPage />} />
          <Route path="/guide" element={<InfoPage kind="guide" />} />
          <Route path="*" element={<InfoPage kind="not-found" />} />
        </Route>
      </Route>
    </Routes>
  );
}

function AuthRedirect({ intent }: { intent: AuthIntent }) {
  return <Navigate to="/" replace state={{ authIntent: intent }} />;
}
