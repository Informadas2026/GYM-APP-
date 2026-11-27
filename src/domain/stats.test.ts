import { blankSet } from './calc';
import { bestStreak, goalWeeksStreak, gymPerWeek, improvedExercises, kmPerWeek, prsInPeriod, runs, strengthHistory, weekStarts, weeklySetsByMuscle } from './stats';
import type { Exercise, Session, SetEntry } from './types';

const set = (w: number, r: number, extra: Partial<SetEntry> = {}): SetEntry => blankSet({ weight: w, reps: r, done: true, ...extra });
const day = (d: number, m = 10) => new Date(2026, m, d, 18).getTime();
const gym = (id: string, t: number, sets: SetEntry[], exerciseId = 'sentadilla'): Session => ({
  id, status: 'done', type: 'gym', title: '', startedAt: t, durationMin: 60, notes: '', updatedAt: t,
  exercises: [{ id: 'e' + id, exerciseId, restSec: 90, notes: '', sets }],
});
const run = (id: string, t: number, km: number, sec: number): Session => ({
  id, status: 'done', type: 'running', title: '', startedAt: t, durationMin: sec / 60, notes: '', updatedAt: t, exercises: [],
  cardio: { distanceKm: km, durationSec: sec, paceSecPerKm: sec / km, elevationM: null, avgHr: null, calories: null, feeling: null },
} as unknown as Session);
const NOW = day(27);

describe('estadísticas de evolución', () => {
  it('mejor racha y semanas cumpliendo objetivo', () => {
    const list = [gym('a', day(2), [set(40, 10)]), gym('b', day(3), [set(40, 10)]), gym('c', day(4), [set(40, 10)]), gym('d', day(10), [set(40, 10)])];
    expect(bestStreak(list)).toBe(3);
    // semana del 23: 4 entrenos; semana del 16: 4; semana del 9: 1
    const wk = [23, 24, 25, 26, 16, 17, 18, 19].map((d, i) => gym('w' + i, day(d), [set(40, 10)]));
    expect(goalWeeksStreak([...list, ...wk], 4, NOW)).toBe(2);
    const weeks = weekStarts(day(16), NOW);
    expect(gymPerWeek(wk, weeks)).toEqual([4, 4]);
  });

  it('historial de fuerza marca récords con el 1RM estimado y sin calentamientos', () => {
    const list = [
      gym('1', day(2), [set(40, 10), set(80, 1, { kind: 'warmup' })]),
      gym('2', day(9), [set(42.5, 10)]),
      gym('3', day(16), [set(40, 8)]),
    ];
    const h = strengthHistory(list, 'sentadilla');
    expect(h.map((p) => p.pr)).toEqual([true, true, false]);
    expect(h[0].topWeight).toBe(40);
    expect(h[1].bestSet).toEqual({ weight: 42.5, reps: 10 });
    expect(prsInPeriod(list, day(5))).toBe(1);
    expect(improvedExercises(list, day(5)).map((x) => x.id)).toEqual(['sentadilla']);
    expect(improvedExercises(list, day(12))).toEqual([]);
  });

  it('series semanales por músculo: principal 1, secundario 0,5', () => {
    const ex = new Map<string, Exercise>([['sentadilla', { id: 'sentadilla', name: 'Sentadilla', primary: 'cuadriceps', secondary: ['gluteos'], equipment: 'barra', custom: false, updatedAt: 0 }]]);
    const list = [gym('a', day(23), [set(40, 10), set(40, 10), set(40, 10), set(20, 10, { kind: 'warmup' })])];
    const r = weeklySetsByMuscle(list, ex, day(23), NOW);
    expect(r).toEqual([{ id: 'cuadriceps', sets: 3 }, { id: 'gluteos', sets: 1.5 }]);
  });

  it('carreras: km por semana y ritmo', () => {
    const list = [run('r1', day(17), 5, 1800), run('r2', day(24), 6, 2100), run('r3', day(25), 4, 1400)];
    const r = runs(list);
    expect(r[1].paceSecPerKm).toBe(350);
    expect(kmPerWeek(r, weekStarts(day(16), NOW))).toEqual([5, 10]);
  });
});
