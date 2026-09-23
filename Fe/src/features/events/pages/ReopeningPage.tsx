import { ui } from '../../../shared/styles/classes';
import { EventCatalog } from '../components/EventCatalog';

export function ReopeningPage() {
  return (
    <main id="main" className={ui('container content-page')}>
      <h1>Vé bán lại từ nhà tổ chức</h1>
      <EventCatalog reopening />
    </main>
  );
}
