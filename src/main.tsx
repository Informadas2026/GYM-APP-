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

// Versión instalable (GitHub Pages): service worker para funcionar sin conexión.
// Busca versión nueva al abrir y al volver a la app; cuando la hay, recarga una vez para usarla.
if (import.meta.env.MODE === 'pages' && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
    const check = () => { void reg.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60_000);
  }).catch((e) => console.warn('[sw]', e));
}
