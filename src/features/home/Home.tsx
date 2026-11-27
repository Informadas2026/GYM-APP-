import { useMemo, useState } from 'react';
import { useAppData } from '../../state';
import { cap, dayKey, rangeStats, sessionDoneSets, sessionDurationMin, startOfWeek, streakDays, weekStats } from '../../domain/calc';
import { DayCard } from './DayCard';
import { Icon } from '../../ui/Icon';
import type { Tab } from '../../ui/NavBar';
import { ACTIVITY, cardioSummary } from '../cardio/CardioForm';

const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const fmtMin = (m: number) => { m = Math.round(m); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
const fmtKm = (km: number) => `${String(Math.round(km * 10) / 10).replace('.', ',')} km`;

export function Home({ go, openSession }: { go: (t: Tab) => void; openSession: (id: string) => void }) {
  const { sessions, active } = useAppData();
  const byDay = (key: string) => sessions.filter((s) => s.status === 'done' && dayKey(s.startedAt) === key);
  const now = Date.now();
  const ws = startOfWeek(now);
  const week = useMemo(() => weekStats(sessions, ws), [sessions, ws]);
  const prev = useMemo(() => weekStats(sessions, ws - 7 * 86_400_000), [sessions, ws]);
  const streak = useMemo(() => streakDays(sessions, now), [sessions, now]);
  const trainedDays = useMemo(() => new Set(sessions.filter((s) => s.status === 'done').map((s) => dayKey(s.startedAt))), [sessions]);
  const done = sessions.filter((s) => s.status === 'done');
  const today = new Date(now);
  const [view, setView] = useState<'semana' | 'mes'>('semana');
  const [selected, setSelected] = useState<number | null>(null);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1).getTime());
  const select = (t: number) => setSelected(selected === t ? null : t);
  const selKey = selected != null ? dayKey(selected) : null;

  return (
    <div className="gutter pb-40 pt-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[56px] font-semibold leading-[0.95]">
            {String(today.getDate()).padStart(2, '0')}.{String(today.getMonth() + 1).padStart(2, '0')}
          </p>
          <p className="mt-1 text-[22px] font-semibold capitalize">{today.toLocaleDateString('es-ES', { weekday: 'long' })}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-card px-4 py-2 ring-1 ring-line" aria-label={`Racha de ${streak} días`}>
          <Icon name="flame" size={18} className="text-hi" />
          <span className="font-display font-semibold">{streak}</span>
          <span className="text-sm text-muted">{streak === 1 ? 'día' : 'días'}</span>
        </div>
      </header>

      <div className="mt-5 flex items-center justify-between gap-2">
        <div className="flex rounded-full bg-card p-1 ring-1 ring-line" role="tablist" aria-label="Vista del calendario">
          {(['semana', 'mes'] as const).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); setSelected(null); }}
              className={`h-9 rounded-full px-4 text-sm font-semibold ${view === v ? 'bg-pill text-pill-fg' : 'text-muted'}`}>{cap(v)}</button>
          ))}
        </div>
        {view === 'mes' && (
          <div className="flex items-center gap-1">
            <button onClick={() => { const d = new Date(month); setMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime()); setSelected(null); }}
              className="grid h-10 w-10 place-items-center rounded-full bg-card2" aria-label="Mes anterior"><Icon name="back" size={18} /></button>
            <button onClick={() => { const d = new Date(month); setMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()); setSelected(null); }}
              disabled={month >= new Date(today.getFullYear(), today.getMonth(), 1).getTime()}
              className="grid h-10 w-10 place-items-center rounded-full bg-card2 disabled:opacity-30" aria-label="Mes siguiente"><Icon name="next" size={18} /></button>
          </div>
        )}
      </div>

      {view === 'semana' ? (
        /* Semana actual: el día elegido (o hoy) se une a la tarjeta de abajo con una burbuja */
        <div className="mt-4 grid grid-cols-7 text-center" aria-label="Esta semana">
          {DAYS.map((d, i) => {
            const t = ws + i * 86_400_000;
            const key = dayKey(t);
            const isToday = key === dayKey(now);
            const trained = trainedDays.has(key);
            const isSel = selKey === key;
            const joined = isSel || (selKey == null && isToday);
            const daySessions = trained ? byDay(key) : [];
            const label = new Date(t).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
            const tone = isSel ? (daySessions[0]?.type === 'gym' || !trained ? 'bg-lav text-lav-ink' : 'bg-paper text-paper-ink') : isToday && selKey == null ? 'bg-lime text-lime-ink' : trained ? 'bg-card2 text-fg' : '';
            const blob = isSel ? (daySessions[0]?.type === 'gym' || !trained ? 'bg-lav' : 'bg-paper') : 'bg-lime';
            return (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span className="text-[12px] font-bold text-muted">{d}</span>
                <button disabled={!trained && !isToday} onClick={() => select(t)} aria-pressed={isSel}
                  aria-label={trained ? `Resumen del ${label}` : `${label}, sin entrenamiento`}
                  className={`relative grid h-10 w-10 place-items-center rounded-full text-[14px] font-semibold transition-colors ${tone} ${isToday && !joined ? 'ring-2 ring-lime' : ''}`}>
                  {new Date(t).getDate()}
                  {trained && !joined && <span className="absolute -bottom-1.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-lav" aria-hidden="true" />}
                  {joined && <span className={`absolute -bottom-4 left-1/2 h-5 w-4 -translate-x-1/2 ${blob}`} aria-hidden="true" />}
                  {daySessions.length > 1 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-pill px-1 text-[10px] text-pill-fg">{daySessions.length}</span>}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <MonthGrid month={month} now={now} trainedDays={trainedDays} selKey={selKey} byDay={byDay} onSelect={select} />
      )}

      {selected != null ? (
        <DayCard key={selKey} day={selected} sessions={byDay(selKey!)} onOpen={openSession} onClose={() => setSelected(null)} />
      ) : view === 'semana' ? (
        <section className="relative z-0 mt-3 rounded-[36px] bg-lime p-6 text-lime-ink">
          <h2 className="font-display text-[22px] font-semibold leading-tight">Esta semana</h2>
          <StatsGrid st={week} />
          {prev.sessions > 0 && (
            <p className="mt-4 text-[13px] font-medium opacity-70">
              Semana anterior: {prev.gymSessions} {prev.gymSessions === 1 ? 'entreno' : 'entrenos'} · {prev.sets} series{prev.runs > 0 ? ` · ${fmtKm(prev.runKm)} corriendo` : ''}
            </p>
          )}
          <p className="mt-3 text-[13px] font-medium opacity-60">Toca un día marcado para ver su resumen.</p>
        </section>
      ) : (
        <MonthCard month={month} sessions={sessions} />
      )}

      {active ? (
        <button onClick={() => go('entreno')} className="mt-3 flex w-full items-center gap-4 rounded-[36px] bg-lav p-5 text-left text-lav-ink">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#131313] text-white"><Icon name="dumbbell" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[18px] font-semibold">Continuar entrenamiento</span>
            <span className="block text-[14px] opacity-70">{active.exercises.length} {active.exercises.length === 1 ? 'ejercicio' : 'ejercicios'} · empezaste a las {new Date(active.startedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
          </span>
          <Icon name="next" />
        </button>
      ) : (
        <button onClick={() => go('entreno')} className="mt-3 flex h-16 w-full items-center justify-between rounded-full bg-pill pl-2 pr-6 text-pill-fg">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-hi text-hi-ink"><Icon name="play" size={20} /></span>
          <span className="font-semibold">Empezar entrenamiento</span>
          <span className="tracking-[-0.2em] opacity-60">›››</span>
        </button>
      )}

      <h2 className="mb-3 mt-8 font-display text-[20px] font-semibold">Últimos entrenamientos</h2>
      {done.length === 0 ? (
        <p className="rounded-[28px] bg-card p-6 text-muted ring-1 ring-line">Aún no hay entrenamientos guardados. Cuando termines el primero aparecerá aquí.</p>
      ) : (
        <ul className="space-y-2">
          {done.slice(0, 4).map((s) => (
            <li key={s.id}>
              <button onClick={() => openSession(s.id)} className="flex w-full items-center gap-4 rounded-[28px] bg-card p-4 text-left ring-1 ring-line">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-paper font-display text-[17px] font-semibold text-paper-ink ring-1 ring-line">
                  {new Date(s.startedAt).getDate()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{s.title || (s.type === 'gym' ? 'Entrenamiento' : ACTIVITY[s.type])}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {new Date(s.startedAt).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })} · {s.type === 'gym' ? `${sessionDurationMin(s)} min · ${sessionDoneSets(s)} series` : cardioSummary(s)}
                  </span>
                </span>
                <Icon name="next" size={18} className="text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatsGrid({ st }: { st: ReturnType<typeof weekStats> }) {
  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
        <Big label="Entrenos" value={String(st.gymSessions)} />
        <Big label="Series" value={String(st.sets)} />
        <Big label="Tiempo gym" value={fmtMin(st.gymMinutes)} />
      </div>
      {st.runs > 0 && (
        <div className="mt-4 border-t border-black/10 pt-3">
          <p className="text-[12px] font-bold uppercase tracking-wider opacity-60">Corriendo · {st.runs} {st.runs === 1 ? 'salida' : 'salidas'}</p>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3">
            <Big label="Km" value={fmtKm(st.runKm)} />
            <Big label="Tiempo" value={fmtMin(st.runMinutes)} />
          </div>
        </div>
      )}
    </>
  );
}

function MonthCard({ month, sessions }: { month: number; sessions: import('../../domain/types').Session[] }) {
  const d = new Date(month);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  const st = rangeStats(sessions, month, end);
  return (
    <section className="relative z-0 mt-3 rounded-[36px] bg-lime p-6 text-lime-ink">
      <h2 className="font-display text-[22px] font-semibold leading-tight">{cap(d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(' de ', ' '))}</h2>
      <StatsGrid st={st} />
      <p className="mt-3 text-[13px] font-medium opacity-60">Toca un día marcado para ver su resumen.</p>
    </section>
  );
}

function MonthGrid({ month, now, trainedDays, selKey, byDay, onSelect }: {
  month: number; now: number; trainedDays: Set<string>; selKey: string | null;
  byDay: (k: string) => import('../../domain/types').Session[]; onSelect: (t: number) => void;
}) {
  const d = new Date(month);
  const first = startOfWeek(month);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const lastDay = new Date(d.getFullYear(), d.getMonth(), daysInMonth).getTime();
  const cells: number[] = [];
  for (let t = first; t <= lastDay || cells.length % 7 !== 0; ) {
    cells.push(t);
    const n = new Date(t); n.setDate(n.getDate() + 1); t = n.getTime();
  }
  const title = cap(d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(' de ', ' '));
  return (
    <div className="mt-4 rounded-[32px] bg-card p-4 ring-1 ring-line">
      <p className="mb-3 text-center font-display text-[17px] font-semibold">{title}</p>
      <div className="grid grid-cols-7 gap-y-1.5 text-center" role="grid" aria-label={`Calendario de ${title}`}>
        {DAYS.map((x) => <span key={x} className="text-[12px] font-bold text-muted">{x}</span>)}
        {cells.map((t) => {
          const key = dayKey(t);
          const inMonth = new Date(t).getMonth() === d.getMonth();
          const trained = trainedDays.has(key);
          const isToday = key === dayKey(now);
          const isSel = key === selKey;
          const list = trained ? byDay(key) : [];
          const hasRun = list.some((s) => s.type !== 'gym');
          const hasGym = list.some((s) => s.type === 'gym');
          return (
            <div key={key} className="flex justify-center">
              <button disabled={!trained || !inMonth} onClick={() => onSelect(t)} aria-pressed={isSel}
                aria-label={`${new Date(t).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}${trained ? ', con entreno' : ''}`}
                className={`relative grid h-10 w-10 place-items-center rounded-full text-[14px] font-semibold transition-colors
                  ${!inMonth ? 'opacity-25' : ''}
                  ${isSel ? 'bg-pill text-pill-fg' : hasGym ? 'bg-lav text-lav-ink' : hasRun ? 'bg-paper text-paper-ink' : ''}
                  ${isToday && !isSel ? 'ring-2 ring-lime' : ''}`}>
                {new Date(t).getDate()}
                {hasGym && hasRun && <span className="absolute -bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-lime" aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-lav" />Gimnasio</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-paper ring-1 ring-line" />Carrera u otra</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-2 ring-lime" />Hoy</span>
      </div>
    </div>
  );
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] font-bold uppercase tracking-wider opacity-60">{label}</p>
      <p className="font-display text-[24px] font-semibold leading-tight">{value}</p>
    </div>
  );
}
