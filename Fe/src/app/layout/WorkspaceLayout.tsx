import { Outlet } from 'react-router-dom';
import { SidebarLayout } from './SidebarLayout';

export function WorkspaceLayout() {
  return (
    <SidebarLayout contentId="workspace-main">
      <div id="workspace-main" tabIndex={-1} className="min-w-0 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </div>
    </SidebarLayout>
  );
}
