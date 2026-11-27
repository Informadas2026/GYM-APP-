import { useEffect, useState } from 'react';
import { AppDataProvider, RestTimerProvider, useAppData } from './state';
import { NavBar, type Tab } from './ui/NavBar';
import { Home } from './features/home/Home';
import { WorkoutTab } from './features/workout/WorkoutTab';
import { RestBar } from './features/workout/RestBar';
import { History } from './features/history/History';
import { SessionDetail } from './features/history/SessionDetail';
import { Progress } from './features/progress/Progress';
import { Profile } from './features/profile/Profile';

const TABS: Tab[] = ['inicio', 'entreno', 'evolucion', 'historial', 'perfil'];
const readHash = (): Tab => {
  const h = location.hash.replace('#', '') as Tab;
  return TABS.includes(h) ? h : 'inicio';
};

function Shell() {
  const { ready, active, settings } = useAppData();
  const [tab, setTab] = useState<Tab>(readHash);
  const [detail, setDetail] = useState<string | null>(null);
  const [editDetail, setEditDetail] = useState(false);

  useEffect(() => {
    const onHash = () => setTab(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (settings.theme === 'system') document.documentElement.removeAttribute('data-app-theme');
    else document.documentElement.setAttribute('data-app-theme', settings.theme);
  }, [settings.theme]);
  useEffect(() => {
    const pal = settings.palette ?? 'electrico';
    if (pal === 'lima') document.documentElement.removeAttribute('data-palette');
    else document.documentElement.setAttribute('data-palette', pal);
  }, [settings.palette]);

  // Mantener la pantalla encendida durante el entrenamiento (si el navegador lo permite).
  useEffect(() => {
    if (!active) return;
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try { lock = await (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null; } catch { /* no disponible */ }
    };
    void req();
    const onVis = () => document.visibilityState === 'visible' && void req();
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); void lock?.release().catch(() => {}); };
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (t: Tab) => {
    setDetail(null);
    setTab(t);
    try { history.replaceState(null, '', '#' + t); } catch { /* sin historial */ }
    window.scrollTo({ top: 0 });
  };
  const openSession = (id: string, edit = false) => { setEditDetail(edit); setDetail(id); window.scrollTo({ top: 0 }); };
  const onPast = (id: string) => { setTab('historial'); openSession(id, true); };

  if (!ready) return <div className="grid h-full place-items-center text-muted">Cargando tus datos…</div>;

  return (
    <div className="mx-auto min-h-full max-w-[560px]">
      <main style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {detail ? <SessionDetail key={detail + String(editDetail)} id={detail} startEditing={editDetail} onClose={() => setDetail(null)} /> : (
          <>
            {tab === 'inicio' && <Home go={go} openSession={(id) => openSession(id)} />}
            {tab === 'entreno' && <WorkoutTab onSaved={(id) => { setTab('historial'); openSession(id); }} onPast={onPast} />}
            {tab === 'evolucion' && <Progress />}
            {tab === 'historial' && <History openSession={(id) => openSession(id)} onPast={onPast} />}
            {tab === 'perfil' && <Profile />}
          </>
        )}
      </main>
      <RestBar />
      <NavBar tab={tab} onChange={go} live={!!active} />
    </div>
  );
}

export default function App() {
  return (
    <AppDataProvider>
      <RestTimerProvider>
        <Shell />
      </RestTimerProvider>
    </AppDataProvider>
  );
}
