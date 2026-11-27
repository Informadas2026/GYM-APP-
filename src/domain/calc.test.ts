import { fmtPace, paceFrom, parseClock, blankSet, completeSet, e1rm, lastPerformance, pickNewer, sessionVolume, setsFromHistory, startOfWeek, streakDays, weekStats } from './calc';
import type { Session, SetEntry } from './types';

const set = (w: number | null, r: number | null, extra: Partial<SetEntry> = {}): SetEntry => blankSet({ weight: w, reps: r, done: true, ...extra });
const session = (id: string, startedAt: number, sets: SetEntry[], exerciseId = 'lib-press-banca', extra: Partial<Session> = {}): Session => ({
  id, status: 'done', type: 'gym', title: '', startedAt, durationMin: 60, notes: '', updatedAt: startedAt,
  exercises: [{ id: 'e' + id, exerciseId, restSec: 90, notes: '', sets }], ...extra,
});

describe('cálculos', () => {
  it('volumen solo cuenta series efectivas completadas', () => {
    const s = session('a', 0, [set(60, 10), set(60, 8), set(20, 15, { kind: 'warmup' }), set(60, 10, { done: false })]);
    expect(sessionVolume(s)).toBe(60 * 10 + 60 * 8);
  });

  it('1RM de Epley', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
    expect(e1rm(0, 5)).toBe(0);
  });

  it('última sesión del ejercicio, excluyendo la actual y las borradas', () => {
    const old = session('old', 1000, [set(50, 10)]);
    const recent = session('recent', 2000, [set(55, 10), set(55, 9)]);
    const deleted = session('del', 3000, [set(99, 1)], 'lib-press-banca', { deleted: true });
    const current = session('cur', 4000, [set(70, 5)]);
    const last = lastPerformance('lib-press-banca', [old, recent, deleted, current], 'cur');
    expect(last?.sessionId).toBe('recent');
    expect(last?.sets.map((s) => s.weight)).toEqual([55, 55]);
    expect(lastPerformance('lib-sentadilla', [old], undefined)).toBeNull();
  });

  it('series nuevas precargadas desde el historial y sin marcar', () => {
    const sets = setsFromHistory({ sessionId: 'x', date: 0, sets: [set(55, 10), set(55, 9)] });
    expect(sets).toHaveLength(2);
    expect(sets.every((s) => !s.done && s.effort === null)).toBe(true);
    expect(sets[1].reps).toBe(9);
    expect(setsFromHistory(null, 3)).toHaveLength(3);
  });

  it('completar una serie rellena huecos y propaga a las siguientes vacías', () => {
    let sets = [blankSet({ weight: 40, reps: 12 }), blankSet(), blankSet({ weight: 45 })];
    sets = completeSet(sets, 0, 123);
    expect(sets[0]).toMatchObject({ done: true, doneAt: 123 });
    expect(sets[1]).toMatchObject({ weight: 40, reps: 12, done: false });
    expect(sets[2]).toMatchObject({ weight: 45, reps: 12 });
    sets = completeSet(sets, 1);
    expect(sets[1].done).toBe(true);
  });

  it('el calentamiento no se copia a las series efectivas y lo copiado se actualiza', () => {
    let sets = [blankSet({ kind: 'warmup' }), blankSet(), blankSet(), blankSet()];
    sets[0] = { ...sets[0], weight: 20, reps: 12 };
    sets = completeSet(sets, 0);
    expect(sets[1].weight).toBeNull();
    sets[1] = { ...sets[1], weight: 40, reps: 10 };
    sets = completeSet(sets, 1);
    expect(sets[2]).toMatchObject({ weight: 40, reps: 10, auto: true });
    sets[2] = { ...sets[2], weight: 42.5, auto: false }; // la usuaria cambia la serie 3
    sets = completeSet(sets, 2);
    expect(sets[3]).toMatchObject({ weight: 42.5, reps: 10 });
  });

  it('semana empieza en lunes y la racha cuenta días seguidos', () => {
    const wed = new Date(2026, 10, 25, 18).getTime(); // miércoles 25/11/2026
    expect(new Date(startOfWeek(wed)).getDay()).toBe(1);
    const day = (d: number) => new Date(2026, 10, d, 19).getTime();
    const list = [session('1', day(23), [set(50, 10)]), session('2', day(24), [set(50, 10)]), session('3', day(25), [set(50, 10)]), session('4', day(20), [set(50, 10)])];
    expect(streakDays(list, wed)).toBe(3);
    expect(streakDays(list, new Date(2026, 10, 26, 9).getTime())).toBe(3); // hoy aún sin entrenar
    expect(streakDays(list, new Date(2026, 10, 28, 9).getTime())).toBe(0);
    const ws = weekStats(list, startOfWeek(wed));
    expect(ws).toMatchObject({ sessions: 3, minutes: 180, volume: 1500, sets: 3 });
  });

  it('el resumen separa gimnasio y carreras (km y tiempo)', () => {
    const wed = new Date(2026, 10, 25, 18).getTime();
    const run = { ...session('r', new Date(2026, 10, 24, 8).getTime(), []), type: 'running' as const,
      cardio: { distanceKm: 6.2, durationSec: 2100, paceSecPerKm: 339, elevationM: null, avgHr: null, calories: null, feeling: null } };
    const ws = weekStats([session('1', new Date(2026, 10, 23, 19).getTime(), [set(50, 10)]), run as never], startOfWeek(wed));
    expect(ws).toMatchObject({ gymSessions: 1, gymMinutes: 60, runs: 1, runMinutes: 35 });
    expect(ws.runKm).toBeCloseTo(6.2);
  });

  it('gana el registro más reciente', () => {
    expect(pickNewer({ updatedAt: 1, v: 'a' }, { updatedAt: 2, v: 'b' })?.v).toBe('b');
    expect(pickNewer({ updatedAt: 3, v: 'a' }, { updatedAt: 2, v: 'b' })?.v).toBe('a');
  });

  it('los drop sets cuentan para el volumen', () => {
    const s = session('d', 0, [set(60, 8), set(45, 6, { kind: 'drop' }), set(20, 10, { kind: 'warmup' })]);
    expect(sessionVolume(s)).toBe(480 + 270);
  });

  it('ritmo y duraciones como en Strava', () => {
    expect(parseClock('32:15')).toBe(1935);
    expect(parseClock('1:05:30')).toBe(3930);
    expect(parseClock('45')).toBe(2700);
    expect(parseClock('abc')).toBeUndefined();
    expect(paceFrom(1935, 5.2)).toBe(372);
    expect(fmtPace(372)).toBe('6:12');
  });
});
