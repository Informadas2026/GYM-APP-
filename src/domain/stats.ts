import type { Exercise, MuscleId, Session } from './types';
import { dayKey, e1rm, isCountable, startOfWeek } from './calc';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

export type Period = '1m' | '3m' | '6m' | '1a' | 'todo';

const done = (sessions: Session[]) => sessions.filter((s) => !s.deleted && s.status === 'done');

/** Inicio del periodo (lunes de la semana correspondiente). «todo» empieza en la primera sesión. */
export function periodStart(period: Period, sessions: Session[], now = Date.now()): number {
  const d = new Date(now);
  if (period === 'todo') {
    const first = done(sessions).reduce((m, s) => Math.min(m, s.startedAt), now);
    return startOfWeek(first);
  }
  const months = { '1m': 1, '3m': 3, '6m': 6, '1a': 12 }[period];
  d.setMonth(d.getMonth() - months);
  // Nunca antes de tu primera sesión: así las medias no cuentan semanas en las que aún no usabas la app.
  const list = done(sessions);
  const first = list.length ? startOfWeek(list.reduce((m, s) => Math.min(m, s.startedAt), now)) : startOfWeek(now);
  return Math.max(startOfWeek(d.getTime()), first);
}

/** Lunes de cada semana desde `start` hasta la semana actual (incluida). */
export function weekStarts(start: number, now = Date.now()): number[] {
  const out: number[] = [];
  const end = startOfWeek(now);
  for (let w = startOfWeek(start); w <= end; ) {
    out.push(w);
    const d = new Date(w);
    d.setDate(d.getDate() + 7); // respeta cambios de hora
    w = d.getTime();
  }
  return out;
}

const weekIndex = (weeks: number[], t: number) => {
  const w = startOfWeek(t);
  return weeks.indexOf(w);
};

/* ---------- Constancia ---------- */

/** Racha más larga de días consecutivos con alguna actividad. */
export function bestStreak(sessions: Session[]): number {
  const days = [...new Set(done(sessions).map((s) => dayKey(s.startedAt)))].sort();
  let best = 0, cur = 0, prev: number | null = null;
  for (const k of days) {
    const [y, m, d] = k.split('-').map(Number);
    const t = new Date(y, m - 1, d, 12).getTime();
    cur = prev != null && Math.round((t - prev) / DAY) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = t;
  }
  return best;
}

/** Entrenos de gimnasio por semana. */
export function gymPerWeek(sessions: Session[], weeks: number[]): number[] {
  const out = weeks.map(() => 0);
  for (const s of done(sessions)) {
    if (s.type !== 'gym') continue;
    const i = weekIndex(weeks, s.startedAt);
    if (i >= 0) out[i]++;
  }
  return out;
}

/** Semanas seguidas (terminadas, hacia atrás desde la anterior a la actual; la actual cuenta si ya cumple) alcanzando el objetivo. */
export function goalWeeksStreak(sessions: Session[], goal: number, now = Date.now()): number {
  const first = done(sessions).filter((s) => s.type === 'gym').reduce((m, s) => Math.min(m, s.startedAt), now);
  const weeks = weekStarts(first, now);
  const per = gymPerWeek(sessions, weeks);
  let i = per.length - 1;
  let n = 0;
  if (i >= 0 && per[i] >= goal) n++;
  i--;
  for (; i >= 0 && per[i] >= goal; i--) n++;
  return n;
}

/** Actividad por día: número de sesiones y si hubo gimnasio / cardio. */
export function activityByDay(sessions: Session[]): Map<string, { gym: number; cardio: number }> {
  const m = new Map<string, { gym: number; cardio: number }>();
  for (const s of done(sessions)) {
    const k = dayKey(s.startedAt);
    const v = m.get(k) ?? { gym: 0, cardio: 0 };
    if (s.type === 'gym') v.gym++; else v.cardio++;
    m.set(k, v);
  }
  return m;
}

/* ---------- Fuerza ---------- */

export interface StrengthPoint {
  date: number;
  sessionId: string;
  /** Mejor 1RM estimado de la sesión. */
  e1rm: number;
  /** Peso más alto levantado en una serie efectiva. */
  topWeight: number;
  /** Serie que dio el mejor 1RM. */
  bestSet: { weight: number; reps: number };
  /** Récord de 1RM estimado en el momento (contando todo el historial anterior). */
  pr: boolean;
}

/** Historial de un ejercicio, una entrada por sesión, en orden cronológico. */
export function strengthHistory(sessions: Session[], exerciseId: string): StrengthPoint[] {
  const pts: StrengthPoint[] = [];
  const sorted = done(sessions).filter((s) => s.type === 'gym').sort((a, b) => a.startedAt - b.startedAt);
  let best = 0;
  for (const s of sorted) {
    let e = 0, top = 0, bestSet = { weight: 0, reps: 0 };
    for (const ex of s.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      for (const set of ex.sets) {
        if (!isCountable(set)) continue;
        const w = set.weight ?? 0, r = set.reps ?? 0;
        const est = e1rm(w, r);
        if (est > e) { e = est; bestSet = { weight: w, reps: r }; }
        top = Math.max(top, w);
      }
    }
    if (e <= 0) continue;
    const pr = e > best + 1e-9;
    if (pr) best = e;
    pts.push({ date: s.startedAt, sessionId: s.id, e1rm: e, topWeight: top, bestSet, pr });
  }
  return pts;
}

/** Ejercicios con datos, ordenados por número de sesiones (más hechos primero). */
export function trackedExercises(sessions: Session[]): { id: string; count: number; last: number }[] {
  const m = new Map<string, { count: number; last: number }>();
  for (const s of done(sessions)) {
    if (s.type !== 'gym') continue;
    for (const ex of s.exercises) {
      if (!ex.sets.some(isCountable)) continue;
      const v = m.get(ex.exerciseId) ?? { count: 0, last: 0 };
      v.count++;
      v.last = Math.max(v.last, s.startedAt);
      m.set(ex.exerciseId, v);
    }
  }
  return [...m.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count || b.last - a.last);
}

/**
 * Ejercicios en los que has mejorado dentro del periodo: el mejor 1RM estimado del periodo
 * supera al mejor de antes del periodo (o a la primera sesión del periodo si no había historial).
 */
export function improvedExercises(sessions: Session[], from: number): { id: string; gainKg: number }[] {
  const out: { id: string; gainKg: number }[] = [];
  for (const { id } of trackedExercises(sessions)) {
    const h = strengthHistory(sessions, id);
    const before = h.filter((p) => p.date < from);
    const inside = h.filter((p) => p.date >= from);
    if (!inside.length) continue;
    const base = before.length ? Math.max(...before.map((p) => p.e1rm)) : inside[0].e1rm;
    const peak = Math.max(...(before.length ? inside : inside.slice(1)).map((p) => p.e1rm), 0);
    if (peak > base + 0.01) out.push({ id, gainKg: peak - base });
  }
  return out.sort((a, b) => b.gainKg - a.gainKg);
}

/** Récords (de 1RM estimado) conseguidos dentro del periodo, sin contar la primera vez que haces un ejercicio. */
export function prsInPeriod(sessions: Session[], from: number): number {
  let n = 0;
  for (const { id } of trackedExercises(sessions)) {
    const h = strengthHistory(sessions, id);
    n += h.filter((p, i) => i > 0 && p.pr && p.date >= from).length;
  }
  return n;
}

/* ---------- Músculos ---------- */

/**
 * Series efectivas por semana para cada músculo, de media en el periodo.
 * El músculo principal cuenta 1 serie y cada secundario media, que es como se suele contar el volumen semanal.
 */
export function weeklySetsByMuscle(
  sessions: Session[], exById: Map<string, Exercise>, from: number, now = Date.now(),
): { id: MuscleId; sets: number }[] {
  const weeks = Math.max(1, weekStarts(from, now).length);
  const m = new Map<MuscleId, number>();
  for (const s of done(sessions)) {
    if (s.type !== 'gym' || s.startedAt < from) continue;
    for (const ex of s.exercises) {
      const info = exById.get(ex.exerciseId);
      if (!info) continue;
      const n = ex.sets.filter(isCountable).length;
      if (!n) continue;
      m.set(info.primary, (m.get(info.primary) ?? 0) + n);
      for (const sec of info.secondary) m.set(sec, (m.get(sec) ?? 0) + n / 2);
    }
  }
  return [...m.entries()].map(([id, total]) => ({ id, sets: total / weeks })).sort((a, b) => b.sets - a.sets);
}

/* ---------- Carrera ---------- */

export interface RunPoint { date: number; sessionId: string; km: number; paceSecPerKm: number; durationSec: number }

export function runs(sessions: Session[], from = 0): RunPoint[] {
  return done(sessions)
    .filter((s) => s.type === 'running' && s.startedAt >= from && (s.cardio?.distanceKm ?? 0) > 0)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => {
      const km = s.cardio!.distanceKm ?? 0;
      const dur = s.cardio!.durationSec ?? 0;
      const pace = s.cardio!.paceSecPerKm || (dur && km ? dur / km : 0);
      return { date: s.startedAt, sessionId: s.id, km, paceSecPerKm: pace, durationSec: dur };
    });
}

export function kmPerWeek(list: RunPoint[], weeks: number[]): number[] {
  const out = weeks.map(() => 0);
  for (const r of list) {
    const i = weekIndex(weeks, r.date);
    if (i >= 0) out[i] += r.km;
  }
  return out;
}

export { WEEK };
