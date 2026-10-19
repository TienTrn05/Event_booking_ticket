import { ui } from '../shared/styles/classes';
import { Outlet } from 'react-router-dom';

/** Keep existing detail-page typography inside the shared home shell. */
export function SiteLayout() {
  return (
    <div className={ui('legacy-site')}>
      <Outlet />
    </div>
  );
}
