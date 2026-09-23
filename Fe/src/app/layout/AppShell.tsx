import { Outlet } from 'react-router-dom';
import { AuthDialogProvider } from '../../features/auth/components/AuthDialog';
import { ui } from '../../shared/styles/classes';
import Navbar from './home/Navbar';
import Footer from './home/Footer';

export function AppShell() {
  return (
    <div className={ui('reference-site min-h-screen bg-ink-50 transition-colors duration-300')}>
      <AuthDialogProvider>
        <Navbar />
        <Outlet />
        <Footer />
      </AuthDialogProvider>
    </div>
  );
}
