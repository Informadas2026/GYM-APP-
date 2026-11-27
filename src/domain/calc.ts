import { newId } from './ids';
import type { Session, SetEntry } from './types';

const DAY = 86_400_000;

/** Duración en minutos (redondeada). */
export function sessionDurationMin(s: Session, now = Date.now()): number {
  if (typeof s.durationMin === 'number') return s.durationMin;
  const end = s.endedAt ?? now;
  return Math.max(0, Math.round((end - s.startedAt) / 60_000));
}

export const isCountable = (set: SetEntry) =>
  set.done && set.kind !== 'warmup' && (set.reps ?? 0) > 0;

/** Volumen = suma de peso × repeticiones de las series efectivas completadas (kg). */
export function setsVolume(sets: SetEntry[]): number {
  return sets.reduce((acc, s) => (isCountable(s) ? acc + (s.weight ?? 0) * (s.reps ?? 0) : acc), 0);
}

export function sessionVolume(s: Session): number {
  return s.exercises.reduce((acc, e) => acc + setsVolume(e.sets), 0);
}

export function sessionDoneSets(s: Session): number {
  return s.exercises.reduce((acc, e) => acc + e.sets.filter(isCountable).length, 0);
}

/** 1RM estimado (Epley). Con 1 repetición devuelve el propio peso. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export interface LastPerformance {
  sessionId: string;
  date: number;
  sets: SetEntry[];
}

/** Última sesión terminada (o la activa, excluida) en la que se completó este ejercicio. */
export function lastPerformance(
  exerciseId: string,
  sessions: Session[],
  excludeSessionId?: string,
): LastPerformance | null {
  let best: LastPerformance | null = null;
  for (const s of sessions) {
    if (s.deleted || s.id === excludeSessionId) continue;
    for (const ex of s.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      const done = ex.sets.filter((x) => x.done && (x.reps ?? 0) > 0);
      if (!done.length) continue;
      if (!best || s.startedAt > best.date) best = { sessionId: s.id, date: s.startedAt, sets: done };
    }
  }
  return best;
}

export const blankSet = (partial: Partial<SetEntry> = {}): SetEntry => ({
  id: newId('s'),
  weight: null,
  reps: null,
  effort: null,
  kind: 'work',
  done: false,
  ...partial,
});

/** Series nuevas para un ejercicio, precargadas con lo que se hizo la última vez. */
export function setsFromHistory(last: LastPerformance | null, defaultCount = 3): SetEntry[] {
  if (!last) return Array.from({ length: defaultCount }, () => blankSet());
  return last.sets.map((p) =>
    blankSet({ weight: p.weight, reps: p.reps, kind: p.kind, effort: null }),
  );
}

/**
 * Marca la serie `index` como hecha. Si le faltan datos, toma los de la serie anterior
 * completada. Copia peso/reps a las series siguientes que siguen vacías.
 */
export function completeSet(sets: SetEntry[], index: number, now = Date.now()): SetEntry[] {
  const next = sets.map((s) => ({ ...s }));
  const target = next[index];
  if (!target) return sets;
  const prev = [...next.slice(0, index)].reverse().find((s) => s.done && s.kind === target.kind);
  if (target.weight == null && prev) target.weight = prev.weight;
  if (target.reps == null && prev) target.reps = prev.reps;
  target.done = true;
  target.doneAt = now;
  target.auto = false;
  // Copia a las siguientes series del mismo tipo que siguen vacías o que se rellenaron solas.
  for (let i = index + 1; i < next.length; i++) {
    const s = next[i];
    if (s.done || s.kind !== target.kind) continue;
    if (s.auto || (s.weight == null && s.reps == null)) {
      s.weight = target.weight;
      s.reps = target.reps;
      s.auto = true;
    } else {
      if (s.weight == null) s.weight = target.weight;
      if (s.reps == null) s.reps = target.reps;
    }
  }
  return next;
}

/** Lunes 00:00 local de la semana de `t`. */
export function startOfWeek(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Días consecutivos con actividad, contando hacia atrás desde hoy (o ayer si hoy aún no hay). */
export function streakDays(sessions: Session[], now = Date.now()): number {
  const days = new Set(sessions.filter((s) => !s.deleted && s.status === 'done').map((s) => dayKey(s.startedAt)));
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setTime(cursor.getTime() - DAY);
  let n = 0;
  while (days.has(dayKey(cursor.getTime()))) {
    n++;
    cursor.setTime(cursor.getTime() - DAY);
  }
  return n;
}

export interface WeekStats {
  sessions: number;
  km: number;
  runs: number;
  minutes: number;
  volume: number;
  sets: number;
  /** Solo sesiones de gimnasio. */
  gymSessions: number;
  gymMinutes: number;
  /** Solo carreras (type 'running'). */
  runKm: number;
  runMinutes: number;
}

export function weekStats(sessions: Session[], weekStart: number): WeekStats {
  return rangeStats(sessions, weekStart, weekStart + 7 * DAY);
}

/** Totales de las sesiones terminadas entre `weekStart` (incluido) y `end` (excluido). */
export function rangeStats(sessions: Session[], weekStart: number, end: number): WeekStats {
  const inWeek = sessions.filter(
    (s) => !s.deleted && s.status === 'done' && s.startedAt >= weekStart && s.startedAt < end,
  );
  const cardio = inWeek.filter((s) => s.type !== 'gym');
  const gym = inWeek.filter((s) => s.type === 'gym');
  const runs = inWeek.filter((s) => s.type === 'running');
  return {
    gymSessions: gym.length,
    gymMinutes: gym.reduce((a, s) => a + sessionDurationMin(s), 0),
    runKm: runs.reduce((a, s) => a + (s.cardio?.distanceKm ?? 0), 0),
    runMinutes: runs.reduce((a, s) => a + (s.cardio?.durationSec ? s.cardio.durationSec / 60 : sessionDurationMin(s)), 0),
    km: cardio.reduce((a, s) => a + (s.cardio?.distanceKm ?? 0), 0),
    runs: runs.length,
    sessions: inWeek.length,
    minutes: inWeek.reduce((a, s) => a + sessionDurationMin(s), 0),
    volume: inWeek.reduce((a, s) => a + sessionVolume(s), 0),
    sets: inWeek.reduce((a, s) => a + sessionDoneSets(s), 0),
  };
}

/** Resolución de conflictos de sincronización: gana la versión más reciente. */
export function pickNewer<T extends { updatedAt: number }>(a: T | undefined, b: T | undefined): T | undefined {
  if (!a) return b;
  if (!b) return a;
  return b.updatedAt > a.updatedAt ? b : a;
}

export function formatKg(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',');
}

export function formatVolume(kg: number): string {
  if (kg >= 10_000) return (kg / 1000).toFixed(1).replace('.', ',') + ' t';
  return Math.round(kg).toLocaleString('es-ES') + ' kg';
}

/** Primera letra en mayúscula (sin capitalizar «de», como haría CSS). */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Ejercicios de una sesión nueva a partir de una rutina: respeta series de calentamiento y efectivas
 * de la rutina, y precarga peso/reps de la última vez que se hizo cada ejercicio.
 */
export function exercisesFromRoutine(
  items: import('./types').RoutineItem[],
  sessions: Session[],
  defaultRestSec: number,
): import('./types').SessionExercise[] {
  return items.map((it) => {
    const last = lastPerformance(it.exerciseId, sessions);
    const lastWarm = last?.sets.filter((s) => s.kind === 'warmup') ?? [];
    const lastWork = last?.sets.filter((s) => s.kind === 'work') ?? [];
    const prevItem = last ? sessions.find((s) => s.id === last.sessionId)?.exercises.find((e) => e.exerciseId === it.exerciseId) : undefined;
    const warm = Array.from({ length: it.warmupSets }, (_, i) =>
      blankSet({ kind: 'warmup', weight: lastWarm[i]?.weight ?? null, reps: lastWarm[i]?.reps ?? null }));
    const work = Array.from({ length: it.workSets }, (_, i) => {
      const p = lastWork[i] ?? lastWork[lastWork.length - 1];
      return blankSet({ weight: p?.weight ?? null, reps: p?.reps ?? null });
    });
    return {
      id: newId('e'),
      exerciseId: it.exerciseId,
      restSec: it.restSec ?? prevItem?.restSec ?? defaultRestSec,
      notes: '',
      targetReps: it.targetReps,
      groupId: it.groupId,
      sets: [...warm, ...work],
    };
  });
}

/** Ritmo en s/km a partir de duración y distancia. */
export function paceFrom(durationSec?: number, km?: number): number | undefined {
  if (!durationSec || !km || km <= 0) return undefined;
  return Math.round(durationSec / km);
}

/** 5:30 /km */
export function fmtPace(secPerKm?: number): string {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '—';
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')}`;
}

/** 1:05:30 o 45:10 */
export function fmtDuration(sec?: number): string {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Acepta «45», «45:10», «1:05:30» o «5:30» (ritmo). Devuelve segundos; un número solo son minutos. */
export function parseClock(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const parts = t.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return undefined;
  if (parts.length === 1) return Math.round(parts[0] * 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
}
