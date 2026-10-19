import './shared/styles/tailwind.css';
import './shared/styles/components.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { initializeTheme } from './shared/theme/theme';
import { initializeMotion } from './shared/motion/preference';
initializeTheme();
initializeMotion();
document.documentElement.classList.add('antialiased', 'scroll-smooth');
document.body.classList.add('bg-page', 'text-foreground', 'font-sans');
const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
