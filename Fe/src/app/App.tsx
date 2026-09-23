import { AppRoutes } from './routes';
import { useRouteScroll } from './useRouteScroll';

export function App() {
  useRouteScroll();
  return <AppRoutes />;
}
