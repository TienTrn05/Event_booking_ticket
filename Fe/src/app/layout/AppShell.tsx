import { Outlet } from 'react-router-dom';
import { CatalogProvider } from '../../features/catalog/components/CatalogProvider';
import { QuickPreviewDialog } from '../../features/preview/components/QuickPreviewDialog';
import { ui } from '../../shared/styles/classes';
import { SidebarLayout } from './SidebarLayout';
import Footer from './home/Footer';

export function AppShell() {
  return (
    <SidebarLayout
      contentId="main-content"
      className={ui(
        'reference-site min-h-screen bg-page text-foreground transition-colors duration-300',
      )}
    >
      <CatalogProvider>
        <div id="main-content" tabIndex={-1}>
          <Outlet />
        </div>
        <Footer />
        <QuickPreviewDialog />
      </CatalogProvider>
    </SidebarLayout>
  );
}
