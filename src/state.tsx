import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './data/db';
import { SEED_EXERCISES } from './data/seedExercises';
import { DEFAULT_SETTINGS, type Exercise, type Routine, type Session, type Settings } from './domain/types';

interface AppData {
  ready: boolean;
  sessions: Session[]; // sin borradas, más recientes primero
  active?: Session;
  exercises: Exercise[];
  exById: Map<string, Exercise>;
  settings: Settings;
  routines: Routine[];
}

const Ctx = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const sessions = useLiveQuery(() => db.sessions.orderBy('startedAt').reverse().filter((s) => !s.deleted).toArray(), []);
  const custom = useLiveQuery(() => db.exercises.toArray(), []);
  const settingsRow = useLiveQuery(() => db.settings.get('settings'), []);
  const routines = useLiveQuery(() => db.routines.orderBy('order').filter((r) => !r.deleted).toArray(), []);

  const value = useMemo<AppData>(() => {
    const byId = new Map<string, Exercise>(SEED_EXERCISES.map((e) => [e.id, e]));
    for (const e of custom ?? []) byId.set(e.id, e);
    const exercises = [...byId.values()].filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const list = (sessions ?? []) as Session[];
    return {
      ready: sessions !== undefined && custom !== undefined,
      sessions: list,
      active: list.find((s) => s.status === 'active'),
      exercises,
      exById: byId,
      settings: { ...DEFAULT_SETTINGS, ...(settingsRow ?? {}) },
      routines: (routines ?? []) as Routine[],
    };
  }, [sessions, custom, settingsRow, routines]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData(): AppData {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppDataProvider ausente');
  return v;
}

// ---------- Temporizador de descanso ----------

interface RestState { endsAt: number; total: number; label: string }
interface RestApi {
  rest: RestState | null;
  remaining: number; // segundos
  finished: boolean;
  start: (sec: number, label: string) => void;
  add: (sec: number) => void;
  stop: () => void;
}
const RestCtx = createContext<RestApi | null>(null);
const KEY = 'cf.rest';

function readRest(): RestState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RestState) : null;
  } catch {
    return null;
  }
}
function writeRest(r: RestState | null) {
  try {
    if (r) localStorage.setItem(KEY, JSON.stringify(r));
    else localStorage.removeItem(KEY);
  } catch { /* almacenamiento no disponible */ }
}

let audioCtx: AudioContext | null = null;
function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
  } catch { /* sin audio */ }
}
function beep() {
  try {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    [0, 0.22, 0.44].forEach((d, i) => {
      const o = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      o.frequency.value = i === 2 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.18);
      o.connect(g).connect(audioCtx!.destination);
      o.start(t + d);
      o.stop(t + d + 0.2);
    });
  } catch { /* sin audio */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* sin vibración */ }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [rest, setRest] = useState<RestState | null>(() => readRest());
  const [now, setNow] = useState(Date.now());
  const firedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!rest) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [rest]);

  const remaining = rest ? Math.max(0, Math.ceil((rest.endsAt - now) / 1000)) : 0;
  const finished = !!rest && remaining === 0;

  useEffect(() => {
    if (finished && rest && firedFor.current !== rest.endsAt) {
      firedFor.current = rest.endsAt;
      beep();
      const t = setTimeout(() => { setRest(null); writeRest(null); }, 6000);
      return () => clearTimeout(t);
    }
  }, [finished, rest]);

  const start = useCallback((sec: number, label: string) => {
    unlockAudio();
    const r = { endsAt: Date.now() + sec * 1000, total: sec, label };
    setNow(Date.now());
    setRest(r);
    writeRest(r);
  }, []);
  const add = useCallback((sec: number) => {
    setRest((r) => {
      if (!r) return r;
      const endsAt = Math.max(Date.now() + 1000, r.endsAt + sec * 1000);
      const next = { ...r, endsAt, total: Math.max(r.total + sec, 1) };
      writeRest(next);
      return next;
    });
  }, []);
  const stop = useCallback(() => { setRest(null); writeRest(null); }, []);

  const api = useMemo(() => ({ rest, remaining, finished, start, add, stop }), [rest, remaining, finished, start, add, stop]);
  return <RestCtx.Provider value={api}>{children}</RestCtx.Provider>;
}

export function useRest(): RestApi {
  const v = useContext(RestCtx);
  if (!v) throw new Error('RestTimerProvider ausente');
  return v;
}

export const fmtClock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
