import 'fake-indexeddb/auto';
import { db } from './db';
import { applyDataFixes, getAllRoutines, getAllSessions, saveSession } from './repo';
import { blankSet, sessionDoneSets, weekStats, startOfWeek } from '../domain/calc';
import type { Routine } from '../domain/types';

beforeEach(async () => {
  await Promise.all([db.sessions.clear(), db.exercises.clear(), db.settings.clear(), db.routines.clear()]);
});

const oldSeed = (id: string): Routine & { _dirty: 0 } => ({ id, name: 'Ejemplo', order: 1, notes: '', updatedAt: 1, items: [], _dirty: 0 });

it('instalación nueva: quita las rutinas de ejemplo antiguas', async () => {
  await db.routines.bulkPut(['r-lunes', 'r-martes', 'r-miercoles', 'r-jueves'].map(oldSeed));
  await db.routines.put({ ...oldSeed('mia'), name: 'Mía' });
  await applyDataFixes();
  expect((await getAllRoutines()).map((r) => r.id)).toEqual(['mia']);
});

it('con entrenamientos guardados respeta las rutinas y cuenta las series escritas sin ✓', async () => {
  await db.routines.bulkPut(['r-lunes', 'r-martes'].map(oldSeed));
  const t = new Date(2026, 10, 24, 18).getTime();
  await saveSession({
    id: 'w-mar', status: 'done', type: 'gym', title: 'Martes', routineId: 'r-martes', startedAt: t, durationMin: 60, notes: '', updatedAt: 0,
    exercises: [{ id: 'e1', exerciseId: 'lib-press-hombro-mancuernas', restSec: 90, notes: '', sets: [
      blankSet({ weight: 8, reps: 10 }), blankSet({ weight: 8, reps: 10, done: true }), blankSet({ weight: 8, reps: 10, auto: true }), blankSet(),
    ] }],
  });
  await applyDataFixes();
  await applyDataFixes(); // solo una vez
  expect(await getAllRoutines()).toHaveLength(2);
  const [s] = await getAllSessions();
  expect(sessionDoneSets(s)).toBe(2); // la escrita + la marcada; la copiada automáticamente y la vacía no
  expect(weekStats([s], startOfWeek(t))).toMatchObject({ sessions: 1, sets: 2 });
});
