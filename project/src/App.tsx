import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import HomePage from '@/pages/HomePage';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-ink-50 transition-colors duration-300">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
