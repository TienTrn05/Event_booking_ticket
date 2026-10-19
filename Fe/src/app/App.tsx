import { AppRoutes } from './routes';
import { useRouteScroll } from './useRouteScroll';
import { AuthDialogProvider } from '../features/auth/components/AuthDialog';
import { LocaleProvider } from '../shared/i18n/LocaleProvider';

export function App() {
  useRouteScroll();
  return (
    <LocaleProvider>
      <AuthDialogProvider>
        <AppRoutes />
      </AuthDialogProvider>
    </LocaleProvider>
  );
}
