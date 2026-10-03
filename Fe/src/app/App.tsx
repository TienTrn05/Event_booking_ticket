import { AppRoutes } from './routes';
import { useRouteScroll } from './useRouteScroll';
import { CatalogProvider } from '../features/catalog/components/CatalogProvider';

export function App() {
  useRouteScroll();
  return (
    <CatalogProvider>
      <AppRoutes />
    </CatalogProvider>
  );
}
