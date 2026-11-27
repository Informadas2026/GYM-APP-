import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startSync } from './data/sync';
import { applyDataFixes, seedRoutinesOnce } from './data/repo';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

void seedRoutinesOnce()
  .then(applyDataFixes)
  .catch((e) => console.warn('[inicio]', e))
  .finally(() => void startSync());

// Versión instalable (GitHub Pages): registra el service worker para funcionar sin conexión.
if (import.meta.env.MODE === 'pages' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('[sw]', e)); });
}
