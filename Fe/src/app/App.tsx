import { Link, Route, Routes } from 'react-router-dom';
import { HomePage } from '../features/events/pages/HomePage';
export function App() {
  return (
    <>
      <header className="site-header">
        <Link to="/" className="brand">
          Event Ticketing
        </Link>
      </header>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="*"
          element={
            <main className="shell">
              <h1>Không tìm thấy trang</h1>
              <Link to="/">Về trang chủ</Link>
            </main>
          }
        />
      </Routes>
    </>
  );
}
