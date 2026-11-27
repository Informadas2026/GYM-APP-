import 'fake-indexeddb/auto';
import { db } from './db';
import { applyDataFixes, getAllRoutines, getAllSessions, saveSession, seedRoutinesOnce } from './repo';
import { blankSet, sessionDoneSets, weekStats, startOfWeek } from '../domain/calc';

beforeEach(async () => {
  await Promise.all([db.sessions.clear(), db.exercises.clear(), db.settings.clear(), db.routines.clear()]);
});

it('cambia el press militar del martes a mancuernas y cuenta las series escritas sin ✓', async () => {
  await seedRoutinesOnce();
  // Simula la rutina tal como se guardó antes de la corrección.
  const martes = (await db.routines.get('r-martes'))!;
  await db.routines.put({ ...martes, items: martes.items.map((it) => (it.id === 'r2-3' ? { ...it, exerciseId: 'lib-press-militar' } : it)) });
  const t = new Date(2026, 10, 24, 18).getTime();
  await saveSession({
    id: 'w-mar', status: 'done', type: 'gym', title: 'Martes', routineId: 'r-martes', startedAt: t, durationMin: 60, notes: '', updatedAt: 0,
    exercises: [{ id: 'e1', exerciseId: 'lib-press-militar', restSec: 90, notes: '', sets: [
      blankSet({ weight: 8, reps: 10 }), blankSet({ weight: 8, reps: 10, done: true }), blankSet({ weight: 8, reps: 10, auto: true }), blankSet(),
    ] }],
  });
  await applyDataFixes();
  await applyDataFixes(); // solo una vez
  const r = (await getAllRoutines()).find((x) => x.id === 'r-martes')!;
  expect(r.items.find((it) => it.id === 'r2-3')?.exerciseId).toBe('lib-press-hombro-mancuernas');
  const [s] = await getAllSessions();
  expect(s.exercises[0].exerciseId).toBe('lib-press-hombro-mancuernas');
  expect(sessionDoneSets(s)).toBe(2); // la escrita + la marcada; la copiada automáticamente y la vacía no
  expect(weekStats([s], startOfWeek(t))).toMatchObject({ sessions: 1, sets: 2, volume: 160 });
});
