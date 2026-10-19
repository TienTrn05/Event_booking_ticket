import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { AuthIntent } from '../features/auth/context/AuthDialogContext';
import { AppShell } from './layout/AppShell';
import { SiteLayout } from './SiteLayout';
import { WorkspaceLayout } from './layout/WorkspaceLayout';
import { CheckoutLayout } from './layout/CheckoutLayout';
import { Skeleton } from '../shared/ui/Page';
const HomePage = lazy(() =>
  import('../features/events/pages/HomePage').then((m) => ({ default: m.HomePage })),
);
const SeatSelectionPage = lazy(() =>
  import('../features/checkout/pages/SeatSelectionPage').then((m) => ({
    default: m.SeatSelectionPage,
  })),
);
const EventCollectionPage = lazy(() =>
  import('../features/events/pages/EventCollectionPage').then((m) => ({
    default: m.EventCollectionPage,
  })),
);
const CatalogCollectionPage = lazy(() =>
  import('../features/catalog/pages/CatalogCollectionPage').then((m) => ({
    default: m.CatalogCollectionPage,
  })),
);
const RecommendedPage = lazy(() =>
  import('../features/events/pages/RecommendedPage').then((m) => ({ default: m.RecommendedPage })),
);
const OnboardingAdminPage = lazy(() =>
  import('../features/auth/pages/OnboardingAdminPage').then((m) => ({
    default: m.OnboardingAdminPage,
  })),
);
const RbacPage = lazy(() =>
  import('../features/access-control/RbacPage').then((m) => ({ default: m.RbacPage })),
);
const CheckoutPage = lazy(() =>
  import('../features/checkout/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })),
);
const MyTicketsPage = lazy(() =>
  import('../features/checkout/pages/MyTicketsPage').then((m) => ({ default: m.MyTicketsPage })),
);
const StaffCheckInPage = lazy(() =>
  import('../features/checkout/pages/StaffCheckInPage').then((m) => ({
    default: m.StaffCheckInPage,
  })),
);
const BlogPage = lazy(() =>
  import('../features/content/pages/BlogPage').then((m) => ({ default: m.BlogPage })),
);
const InfoPage = lazy(() =>
  import('../features/content/pages/InfoPage').then((m) => ({ default: m.InfoPage })),
);
const EventDetailPage = lazy(() =>
  import('../features/events/pages/EventDetailPage').then((m) => ({ default: m.EventDetailPage })),
);
const ReopeningPage = lazy(() =>
  import('../features/events/pages/ReopeningPage').then((m) => ({ default: m.ReopeningPage })),
);
const ProductPage = lazy(() =>
  import('../features/merchandise/pages/ProductPage').then((m) => ({ default: m.ProductPage })),
);
const OrganizerPage = lazy(() =>
  import('../features/organizer/pages/OrganizerPage').then((m) => ({ default: m.OrganizerPage })),
);
const OrganizerWorkspacePage = lazy(() =>
  import('../features/workspace/OrganizerWorkspacePage').then((m) => ({
    default: m.OrganizerWorkspacePage,
  })),
);
const OrganizerEventPage = lazy(() =>
  import('../features/workspace/OrganizerEventPage').then((m) => ({
    default: m.OrganizerEventPage,
  })),
);
const AdminWorkspacePage = lazy(() =>
  import('../features/workspace/AdminWorkspacePage').then((m) => ({
    default: m.AdminWorkspacePage,
  })),
);
const MerchandiseOrderPage = lazy(() =>
  import('../features/checkout/pages/MerchandiseOrderPage').then((m) => ({
    default: m.MerchandiseOrderPage,
  })),
);
const MyMerchandiseOrdersPage = lazy(() =>
  import('../features/checkout/pages/MerchandiseOrderPage').then((m) => ({
    default: m.MyMerchandiseOrdersPage,
  })),
);

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Loading"
          className="mx-auto grid min-h-[55vh] max-w-[1240px] content-start gap-5 p-6"
        >
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-60 w-full" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<WorkspaceLayout />}>
        <Route
          path="/organizer"
          element={
            <LazyPage>
              <OrganizerWorkspacePage />
            </LazyPage>
          }
        />
        <Route
          path="/organizer/events/:eventId"
          element={
            <LazyPage>
              <OrganizerEventPage />
            </LazyPage>
          }
        />
        <Route
          path="/organizer/check-in"
          element={
            <LazyPage>
              <StaffCheckInPage />
            </LazyPage>
          }
        />
        <Route
          path="/admin"
          element={
            <LazyPage>
              <AdminWorkspacePage />
            </LazyPage>
          }
        />
        <Route
          path="/admin/rbac"
          element={
            <LazyPage>
              <RbacPage />
            </LazyPage>
          }
        />
        <Route
          path="/admin/onboarding"
          element={
            <LazyPage>
              <OnboardingAdminPage />
            </LazyPage>
          }
        />
      </Route>
      <Route element={<CheckoutLayout />}>
        <Route
          path="/events/:eventId/book"
          element={
            <LazyPage>
              <SeatSelectionPage />
            </LazyPage>
          }
        />
        <Route
          path="/checkout/:bookingId"
          element={
            <LazyPage>
              <CheckoutPage />
            </LazyPage>
          }
        />
        <Route
          path="/payments/return"
          element={
            <LazyPage>
              <CheckoutPage />
            </LazyPage>
          }
        />
        <Route
          path="/payments/cancel"
          element={
            <LazyPage>
              <CheckoutPage />
            </LazyPage>
          }
        />
        <Route
          path="/merchandise/orders/:orderId"
          element={
            <LazyPage>
              <MerchandiseOrderPage />
            </LazyPage>
          }
        />
      </Route>
      <Route element={<AppShell />}>
        <Route
          path="/"
          element={
            <LazyPage>
              <HomePage />
            </LazyPage>
          }
        />
        <Route path="/login" element={<AuthRedirect intent="login" />} />
        <Route
          path="/events"
          element={
            <LazyPage>
              <EventCollectionPage />
            </LazyPage>
          }
        />
        <Route
          path="/for-you"
          element={
            <LazyPage>
              <RecommendedPage />
            </LazyPage>
          }
        />
        <Route
          path="/organizers"
          element={
            <LazyPage>
              <CatalogCollectionPage kind="organizers" />
            </LazyPage>
          }
        />
        <Route
          path="/merchandise"
          element={
            <LazyPage>
              <CatalogCollectionPage kind="merchandise" />
            </LazyPage>
          }
        />
        <Route path="/register" element={<AuthRedirect intent="register" />} />
        <Route
          path="/my-tickets"
          element={
            <LazyPage>
              <MyTicketsPage />
            </LazyPage>
          }
        />
        <Route
          path="/my-orders"
          element={
            <LazyPage>
              <MyMerchandiseOrdersPage />
            </LazyPage>
          }
        />
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
