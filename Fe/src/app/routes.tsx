import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { AuthIntent } from '../features/auth/context/AuthDialogContext';
import { HomePage } from '../features/events/pages/HomePage';
import { AppShell } from './layout/AppShell';
import { SiteLayout } from './SiteLayout';

const BlogPage = lazy(() =>
  import('../features/content/pages/BlogPage').then((module) => ({ default: module.BlogPage })),
);
const InfoPage = lazy(() =>
  import('../features/content/pages/InfoPage').then((module) => ({ default: module.InfoPage })),
);
const EventDetailPage = lazy(() =>
  import('../features/events/pages/EventDetailPage').then((module) => ({
    default: module.EventDetailPage,
  })),
);
const ReopeningPage = lazy(() =>
  import('../features/events/pages/ReopeningPage').then((module) => ({
    default: module.ReopeningPage,
  })),
);
const ProductPage = lazy(() =>
  import('../features/merchandise/pages/ProductPage').then((module) => ({
    default: module.ProductPage,
  })),
);
const OrganizerPage = lazy(() =>
  import('../features/organizer/pages/OrganizerPage').then((module) => ({
    default: module.OrganizerPage,
  })),
);

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-[55vh] bg-home-page" />}>{children}</Suspense>;
}

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
          <Route
            path="/reopening"
            element={
              <LazyPage>
                <ReopeningPage />
              </LazyPage>
            }
          />
          <Route
            path="/events/:eventId"
            element={
              <LazyPage>
                <EventDetailPage />
              </LazyPage>
            }
          />
          <Route
            path="/merchandise/:productId"
            element={
              <LazyPage>
                <ProductPage />
              </LazyPage>
            }
          />
          <Route
            path="/organizers/:organizerId"
            element={
              <LazyPage>
                <OrganizerPage />
              </LazyPage>
            }
          />
          <Route
            path="/blog"
            element={
              <LazyPage>
                <BlogPage />
              </LazyPage>
            }
          />
          <Route
            path="/blog/:articleId"
            element={
              <LazyPage>
                <BlogPage />
              </LazyPage>
            }
          />
          <Route
            path="/guide"
            element={
              <LazyPage>
                <InfoPage kind="guide" />
              </LazyPage>
            }
          />
          <Route
            path="*"
            element={
              <LazyPage>
                <InfoPage kind="not-found" />
              </LazyPage>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

function AuthRedirect({ intent }: { intent: AuthIntent }) {
  return <Navigate to="/" replace state={{ authIntent: intent }} />;
}
