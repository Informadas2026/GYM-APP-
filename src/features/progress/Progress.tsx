import { useMemo, useState, type ReactNode } from 'react';
import { useAppData } from '../../state';
import { dayKey, fmtDuration, fmtPace, formatKg, streakDays } from '../../domain/calc';
import { MUSCLES, muscleName } from '../../domain/muscles';
import {
  activityByDay, bestStreak, goalWeeksStreak, gymPerWeek, improvedExercises, kmPerWeek, periodStart, prsInPeriod,
  runs as runList, strengthHistory, trackedExercises, weekStarts, weeklySetsByMuscle, type Period,
} from '../../domain/stats';
import { Bars, Line, RangeBars } from '../../ui/charts';
import { Segmented } from '../../ui/Sheet';

const GOAL = 4;
const PERIODS: { value: Period; label: string; short: string }[] = [
  { value: '1m', label: 'mes', short: '1 mes' }, { value: '3m', label: '3 meses', short: '3 m' }, { value: '6m', label: '6 meses', short: '6 m' },
  { value: '1a', label: '12 meses', short: '1 año' }, { value: 'todo', label: 'Todo', short: 'Todo' },
];
const shortDate = (t: number) => new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
const kg = (v: number) => `${formatKg(Math.round(v * 2) / 2)} kg`;
const km = (v: number) => `${String(Math.round(v * 10) / 10).replace('.', ',')} km`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function Progress() {
  const { sessions, exById } = useAppData();
  const [period, setPeriod] = useState<Period>('3m');
  const now = Date.now();
  const from = useMemo(() => periodStart(period, sessions, now), [period, sessions]); // eslint-disable-line react-hooks/exhaustive-deps
  const weeks = useMemo(() => weekStarts(from, now), [from]); // eslint-disable-line react-hooks/exhaustive-deps
  const doneCount = sessions.filter((s) => s.status === 'done' && !s.deleted).length;

  const improved = useMemo(() => improvedExercises(sessions, from), [sessions, from]);
  const prs = useMemo(() => prsInPeriod(sessions, from), [sessions, from]);
  const gymWeeks = useMemo(() => gymPerWeek(sessions, weeks), [sessions, weeks]);
  const runsIn = useMemo(() => runList(sessions, from), [sessions, from]);
  const gymTotal = gymWeeks.reduce((a, b) => a + b, 0);
  const kmTotal = runsIn.reduce((a, r) => a + r.km, 0);
  const repeated = useMemo(() => trackedExercises(sessions).some((t) => t.count > 1), [sessions]);

  return (
    <div className="gutter pb-40 pt-8">
      <h1 className="font-display text-[38px] font-semibold leading-none">Evolución</h1>
      <div role="radiogroup" aria-label="Periodo" className="mt-4 grid grid-cols-5 gap-1 rounded-full bg-card2 p-1">
        {PERIODS.map((o) => (
          <button key={o.value} role="radio" aria-checked={o.value === period} onClick={() => setPeriod(o.value)}
            className={`h-10 rounded-full text-[13px] font-semibold ${o.value === period ? 'bg-pill text-pill-fg' : ''}`}>{o.short}</button>
        ))}
      </div>

      {doneCount === 0 ? (
        <p className="mt-6 rounded-[28px] bg-card p-6 text-muted ring-1 ring-line">Cuando guardes tus primeros entrenamientos verás aquí si estás progresando: constancia, fuerza por ejercicio, músculos y carrera.</p>
      ) : (
        <>
          <section className="mt-4 rounded-[36px] bg-lime p-6 text-lime-ink">
            <p className="text-[12px] font-bold uppercase tracking-wider opacity-60">{period === 'todo' ? 'Desde el principio' : period === '1m' ? 'Último mes' : `Últimos ${PERIODS.find((p) => p.value === period)!.label}`}</p>
            <p className="mt-1 font-display text-[24px] font-semibold leading-tight">
              {improved.length > 0 ? <>Has subido fuerza en {plural(improved.length, 'ejercicio', 'ejercicios')}</> : !repeated ? <>Tu progreso aparecerá cuando repitas tus ejercicios</> : gymTotal > 0 ? <>Mantienes tus marcas. A por la siguiente subida</> : <>Sin entrenos de fuerza en este periodo</>}
            </p>
            {improved.length > 0 && (
              <p className="mt-2 text-[14px] font-medium opacity-75">
                Lo que más: {improved.slice(0, 2).map((x) => `${exById.get(x.id)?.name ?? 'Ejercicio'} (+${kg(x.gainKg)})`).join(' y ')}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip>{plural(gymTotal, 'entreno', 'entrenos')}</Chip>
              {repeated && <Chip>{plural(prs, 'récord', 'récords')}</Chip>}
              {runsIn.length > 0 && <Chip>{km(kmTotal)} corriendo</Chip>}
            </div>
          </section>

          <Consistency weeks={weeks} gymWeeks={gymWeeks} now={now} />
          <Strength from={from} now={now} />
          <Muscles from={from} now={now} />
          <Running from={from} now={now} weeks={weeks} />
        </>
      )}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-black/10 px-3 py-1.5 text-[13px] font-semibold">{children}</span>;
}

function Block({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-[32px] bg-card p-5 ring-1 ring-line">
      <h2 className="font-display text-[20px] font-semibold">{title}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-muted">{sub}</p>}
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[22px] bg-card2 px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display text-[18px] font-semibold leading-tight">{value}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

/* ---------- 1. Constancia ---------- */

function Consistency({ weeks, gymWeeks, now }: { weeks: number[]; gymWeeks: number[]; now: number }) {
  const { sessions } = useAppData();
  const byDay = useMemo(() => activityByDay(sessions), [sessions]);
  const streak = streakDays(sessions, now);
  const best = bestStreak(sessions);
  const goalStreak = goalWeeksStreak(sessions, GOAL, now);
  const avg = gymWeeks.length ? gymWeeks.reduce((a, b) => a + b, 0) / gymWeeks.length : 0;

  return (
    <Block title="Constancia" sub={`Tu objetivo: ${GOAL} entrenos de fuerza por semana`}>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Tile label="Racha" value={plural(streak, 'día', 'días')} sub="ahora" />
        <Tile label="Mejor" value={plural(best, 'día', 'días')} sub="racha" />
        <Tile label={`Sem. ${GOAL}+`} value={String(goalStreak)} sub="seguidas" />
      </div>
      <MonthCalendar byDay={byDay} now={now} />
      <h3 className="mt-5 text-[14px] font-semibold">Entrenos de fuerza por semana <span className="font-normal text-muted">· media {String(Math.round(avg * 10) / 10).replace('.', ',')}</span></h3>
      <Bars values={gymWeeks} labels={weeks.map(shortDate)} goal={GOAL} goalLabel={`Objetivo ${GOAL}`} integer ariaLabel="Entrenos de fuerza por semana"
        format={(v) => String(Math.round(v))}
        tip={(i) => `Semana del ${shortDate(weeks[i])} · ${plural(gymWeeks[i], 'entreno', 'entrenos')}`} />
    </Block>
  );
}

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/** Calendario de un mes: semanas en filas, lunes a domingo en columnas. Las flechas cambian de mes. */
function MonthCalendar({ byDay, now }: { byDay: Map<string, { gym: number; cardio: number }>; now: number }) {
  const { sessions } = useAppData();
  const today = new Date(now);
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1).getTime());
  const [sel, setSel] = useState<number | null>(null);
  const d = new Date(month);
  const firstEver = sessions.filter((s) => s.status === 'done' && !s.deleted).reduce((m, s) => Math.min(m, s.startedAt), now);
  const canPrev = month > new Date(new Date(firstEver).getFullYear(), new Date(firstEver).getMonth(), 1).getTime();
  const canNext = month < new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  const shift = (n: number) => { setSel(null); setMonth(new Date(d.getFullYear(), d.getMonth() + n, 1).getTime()); };

  const lead = (d.getDay() + 6) % 7;
  const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: dim }, (_, i) => new Date(d.getFullYear(), d.getMonth(), i + 1, 12).getTime())];
  while (cells.length % 7) cells.push(null);
  let gymDays = 0, cardioDays = 0;
  for (const t of cells) { if (t == null) continue; const v = byDay.get(dayKey(t)); if (v?.gym) gymDays++; if (v?.cardio) cardioDays++; }
  const title = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(' de ', ' ');
  const selInfo = sel != null ? byDay.get(dayKey(sel)) : undefined;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <button onClick={() => shift(-1)} disabled={!canPrev} aria-label="Mes anterior" className="grid h-10 w-10 place-items-center rounded-full bg-card2 text-[18px] font-bold disabled:opacity-30">‹</button>
        <p className="font-display text-[17px] font-semibold first-letter:uppercase">{title}</p>
        <button onClick={() => shift(1)} disabled={!canNext} aria-label="Mes siguiente" className="grid h-10 w-10 place-items-center rounded-full bg-card2 text-[18px] font-bold disabled:opacity-30">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-y-1.5 text-center" role="grid" aria-label={`Días entrenados en ${title}`}>
        {DOW.map((x) => <span key={x} className="text-[12px] font-bold text-muted">{x}</span>)}
        {cells.map((t, i) => {
          if (t == null) return <span key={'x' + i} />;
          const v = byDay.get(dayKey(t));
          const isToday = dayKey(t) === dayKey(now);
          const future = t > now + 43_200_000;
          return (
            <div key={t} className="flex justify-center">
              <button onClick={() => setSel(sel === t ? null : t)} disabled={future}
                aria-label={`${new Date(t).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}${v?.gym ? ', fuerza' : ''}${v?.cardio ? ', carrera' : ''}`}
                className={`relative grid h-10 w-10 place-items-center rounded-full text-[14px] font-semibold
                  ${v?.gym ? 'bg-[var(--chart)] text-[var(--chart-ink)]' : v?.cardio ? 'ring-2 ring-inset ring-[var(--chart)]' : future ? 'opacity-30' : 'text-muted'}
                  ${sel === t ? 'outline outline-2 outline-offset-2 outline-[var(--fg)]' : ''}`}>
                {new Date(t).getDate()}
                {!!v?.gym && !!v?.cardio && <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--chart)]" aria-hidden="true" />}
                {isToday && !v && <span className="absolute -bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--muted)]" aria-hidden="true" />}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[13px] font-semibold">
        {sel != null
          ? `${new Date(sel).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}: ${[selInfo?.gym ? 'fuerza' : '', selInfo?.cardio ? 'carrera' : ''].filter(Boolean).join(' y ') || 'descanso'}`
          : `${plural(gymDays, 'día', 'días')} de fuerza · ${plural(cardioDays, 'día', 'días')} de carrera`}
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[var(--chart)]" />Fuerza</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full ring-2 ring-inset ring-[var(--chart)]" />Carrera</span>
      </div>
    </div>
  );
}

/* ---------- 2. Fuerza por ejercicio ---------- */

function Strength({ from, now }: { from: number; now: number }) {
  const { sessions, exById } = useAppData();
  const tracked = useMemo(() => trackedExercises(sessions), [sessions]);
  const [sel, setSel] = useState<string | null>(null);
  const [metric, setMetric] = useState<'e1rm' | 'peso'>('e1rm');
  const id = sel && tracked.some((t) => t.id === sel) ? sel : tracked[0]?.id;
  const history = useMemo(() => (id ? strengthHistory(sessions, id) : []), [sessions, id]);
  const pts = history.filter((p) => p.date >= from);

  if (!tracked.length) {
    return <Block title="Fuerza por ejercicio"><p className="mt-3 text-muted">Registra series con peso y repeticiones para ver tu progreso.</p></Block>;
  }
  const val = (p: (typeof history)[number]) => (metric === 'e1rm' ? p.e1rm : p.topWeight);
  const bestEver = history.length ? Math.max(...history.map(val)) : 0;
  const before = history.filter((p) => p.date < from);
  const base = before.length ? val(before[before.length - 1]) : pts[0] ? val(pts[0]) : 0;
  const last = pts.length ? val(pts[pts.length - 1]) : 0;
  const change = pts.length ? last - base : 0;

  return (
    <Block title="Fuerza por ejercicio" sub="Elige un ejercicio. Los puntos rellenos son récords.">
      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {tracked.slice(0, 8).map((t) => (
          <button key={t.id} onClick={() => setSel(t.id)}
            className={`h-10 shrink-0 rounded-full px-4 text-[13px] font-semibold ${t.id === id ? 'bg-pill text-pill-fg' : 'bg-card2'}`}>
            {exById.get(t.id)?.name ?? 'Ejercicio'}
          </button>
        ))}
      </div>
      {tracked.length > 8 && (
        <select value={id} onChange={(e) => setSel(e.target.value)} aria-label="Todos los ejercicios"
          className="mt-2 h-11 w-full rounded-full bg-card2 px-4 text-[14px] font-semibold text-fg outline-none">
          {tracked.map((t) => <option key={t.id} value={t.id}>{exById.get(t.id)?.name ?? t.id} ({t.count})</option>)}
        </select>
      )}
      <div className="mt-3">
        <Segmented label="Métrica" value={metric} onChange={setMetric}
          options={[{ value: 'e1rm', label: '1RM estimado' }, { value: 'peso', label: 'Peso máximo' }]} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Tile label="Récord" value={kg(bestEver)} sub={history.length ? shortDate(history.reduce((a, p) => (val(p) >= val(a) ? p : a)).date) : undefined} />
        <Tile label="Cambio" value={pts.length ? `${change >= 0 ? '+' : '−'}${kg(Math.abs(change))}` : '—'} sub={`en ${plural(pts.length, 'sesión', 'sesiones')}`} />
      </div>
      {pts.length === 0 ? (
        <p className="mt-4 text-[14px] text-muted">No hiciste este ejercicio en este periodo. Prueba con un periodo más largo.</p>
      ) : pts.length === 1 ? (
        <p className="mt-4 text-[14px] text-muted">Solo hay una sesión en este periodo ({shortDate(pts[0].date)}: {formatKg(pts[0].bestSet.weight)} kg × {pts[0].bestSet.reps}). Con la siguiente verás la línea.</p>
      ) : (
        <Line from={from} to={now} ariaLabel={`Evolución de ${exById.get(id!)?.name ?? 'ejercicio'}`}
          points={pts.map((p) => ({ t: p.date, v: val(p), mark: p.pr }))}
          format={(v) => formatKg(Math.round(v))}
          tip={(i) => (
            <span>{shortDate(pts[i].date)}{pts[i].pr ? ' · Récord' : ''}<br />
              {metric === 'e1rm' ? `1RM est. ${kg(pts[i].e1rm)} · ` : `Máx. ${kg(pts[i].topWeight)} · `}{formatKg(pts[i].bestSet.weight)} kg × {pts[i].bestSet.reps}</span>
          )} />
      )}
      {metric === 'e1rm' && <p className="mt-2 text-[12px] text-muted">1RM estimado: el peso que podrías levantar una vez, calculado con tu mejor serie (peso × (1 + reps / 30)). Sirve para comparar series con distintas repeticiones.</p>}
    </Block>
  );
}

/* ---------- 3. Músculos ---------- */

function Muscles({ from, now }: { from: number; now: number }) {
  const { sessions, exById } = useAppData();
  const data = useMemo(() => weeklySetsByMuscle(sessions, exById, from, now), [sessions, exById, from, now]);
  const map = new Map(data.map((d) => [d.id, d.sets]));
  const rows = MUSCLES.map((m) => ({ label: muscleName(m.id), value: map.get(m.id) ?? 0 })).sort((a, b) => b.value - a.value);
  const low = rows.filter((r) => r.value < 10).map((r) => r.label);
  return (
    <Block title="Músculos" sub="Series por semana de media. La zona discontinua es la referencia de 10 a 20 series.">
      <RangeBars rows={rows} band={[10, 20]} max={Math.max(24, ...rows.map((r) => r.value))} unit="series por semana" />
      {low.length > 0 && low.length < rows.length && (
        <p className="mt-4 text-[13px] text-muted">Por debajo de 10: {low.slice(0, 5).join(', ')}{low.length > 5 ? '…' : ''}. Si alguno te importa, súmale una o dos series a la semana.</p>
      )}
      <p className="mt-2 text-[12px] text-muted">El músculo principal de cada ejercicio cuenta una serie y los secundarios media.</p>
    </Block>
  );
}

/* ---------- 4. Carrera ---------- */

function Running({ from, now, weeks }: { from: number; now: number; weeks: number[] }) {
  const { sessions } = useAppData();
  const list = useMemo(() => runList(sessions, from), [sessions, from]);
  if (!list.length) {
    return <Block title="Carrera"><p className="mt-3 text-muted">No hay carreras en este periodo. Regístralas desde Entrenamiento → Registrar carrera.</p></Block>;
  }
  const perWeek = kmPerWeek(list, weeks);
  const longest = list.reduce((a, r) => (r.km > a.km ? r : a), list[0]);
  const paced = list.filter((r) => r.paceSecPerKm > 0);
  const bestPace = paced.length ? paced.reduce((a, r) => (r.paceSecPerKm < a.paceSecPerKm ? r : a), paced[0]) : null;
  const total = list.reduce((a, r) => a + r.km, 0);

  return (
    <Block title="Carrera">
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Tile label="Km" value={km(total)} sub={plural(list.length, 'salida', 'salidas')} />
        <Tile label="Más larga" value={km(longest.km)} sub={`${shortDate(longest.date)} · ${fmtDuration(longest.durationSec)}`} />
        <Tile label="Mejor ritmo" value={bestPace ? `${fmtPace(bestPace.paceSecPerKm)} /km` : '—'} sub={bestPace ? shortDate(bestPace.date) : undefined} />
        <Tile label="Media semanal" value={km(total / Math.max(1, weeks.length))} />
      </div>
      <h3 className="mt-5 text-[14px] font-semibold">Km por semana</h3>
      <Bars values={perWeek} labels={weeks.map(shortDate)} ariaLabel="Kilómetros por semana" integer format={(v) => String(Math.round(v))}
        tip={(i) => `Semana del ${shortDate(weeks[i])} · ${km(perWeek[i])}`} />
      {paced.length >= 2 && (
        <>
          <h3 className="mt-5 text-[14px] font-semibold">Ritmo medio <span className="font-normal text-muted">· arriba = más rápido</span></h3>
          <Line from={from} to={now} invert ariaLabel="Ritmo medio por carrera"
            points={paced.map((r) => ({ t: r.date, v: r.paceSecPerKm, mark: r === bestPace }))}
            format={(v) => fmtPace(v)}
            tip={(i) => <span>{shortDate(paced[i].date)} · {km(paced[i].km)}<br />{fmtPace(paced[i].paceSecPerKm)} /km</span>} />
        </>
      )}
    </Block>
  );
}
