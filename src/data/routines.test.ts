import 'fake-indexeddb/auto';
import { db } from './db';
import { deleteRoutine, getAllRoutines, getDirty, saveRoutine } from './repo';
import { SEED_EXERCISES } from './seedExercises';
import { blankSet, exercisesFromRoutine } from '../domain/calc';
import type { Routine, Session } from '../domain/types';

const sample: Routine = {
  id: 'r-a', name: 'Pierna', order: 1, notes: '', updatedAt: 1,
  items: [
    { id: 'i1', exerciseId: 'lib-sentadilla', warmupSets: 1, workSets: 3 },
    { id: 'i2', exerciseId: 'lib-hip-thrust', warmupSets: 0, workSets: 3 },
  ],
};

beforeEach(async () => {
  await Promise.all([db.sessions.clear(), db.exercises.clear(), db.settings.clear(), db.routines.clear()]);
});

describe('rutinas', () => {
  it('los ejercicios de ejemplo existen en la biblioteca', () => {
    const ids = new Set(SEED_EXERCISES.map((e) => e.id));
    for (const it of sample.items) expect(ids.has(it.exerciseId), it.exerciseId).toBe(true);
  });

  it('una instalación nueva empieza sin rutinas', async () => {
    expect(await getAllRoutines()).toHaveLength(0);
  });

  it('editar y borrar una rutina queda pendiente de sincronizar', async () => {
    await saveRoutine(sample);
    const [r] = await getAllRoutines();
    await saveRoutine({ ...r, items: r.items.map((it) => ({ ...it, targetReps: '8-10' })) });
    expect((await getAllRoutines())[0].items[0].targetReps).toBe('8-10');
    expect((await getDirty()).routines).toHaveLength(1);
    await deleteRoutine('r-a');
    expect(await getAllRoutines()).toHaveLength(0);
  });

  it('una sesión desde la rutina respeta calentamiento y precarga la última vez', () => {
    const prev: Session = {
      id: 'p', status: 'done', type: 'gym', title: '', startedAt: 10, notes: '', updatedAt: 10,
      exercises: [{ id: 'x', exerciseId: 'lib-sentadilla', restSec: 150, notes: '', sets: [
        blankSet({ kind: 'warmup', weight: 20, reps: 12, done: true }),
        blankSet({ weight: 50, reps: 8, done: true }), blankSet({ weight: 52.5, reps: 8, done: true }),
      ] }],
    };
    const [sq, hip] = exercisesFromRoutine(sample.items, [prev], 90);
    expect(sq.sets.map((s) => [s.kind, s.weight, s.reps, s.done])).toEqual([
      ['warmup', 20, 12, false], ['work', 50, 8, false], ['work', 52.5, 8, false], ['work', 52.5, 8, false],
    ]);
    expect(sq.restSec).toBe(150);
    expect(hip.sets).toHaveLength(3);
    expect(hip.sets.every((s) => s.weight === null && s.reps === null)).toBe(true);
    expect(hip.restSec).toBe(90);
  });
});
