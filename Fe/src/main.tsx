import { uiClasses } from './shared/styles/classes';
import './shared/styles/tailwind.css';
import './shared/styles/components.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app/App';
import { initializeTheme } from './shared/theme/theme';
initializeTheme();
document.documentElement.classList.add(...uiClasses['$html']!.split(/\s+/));
document.body.classList.add(...uiClasses['$body']!.split(/\s+/));
const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');
createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
