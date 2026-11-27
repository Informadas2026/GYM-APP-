import 'fake-indexeddb/auto';
import { db } from './db';
import { deleteRoutine, getAllRoutines, getDirty, getSettings, saveRoutine, seedRoutinesOnce } from './repo';
import { SEED_ROUTINES } from './seedRoutines';
import { SEED_EXERCISES } from './seedExercises';
import { blankSet, exercisesFromRoutine } from '../domain/calc';
import type { Session } from '../domain/types';

beforeEach(async () => {
  await Promise.all([db.sessions.clear(), db.exercises.clear(), db.settings.clear(), db.routines.clear()]);
});

describe('rutinas', () => {
  it('todas las rutinas de Olga usan ejercicios que existen en la biblioteca', () => {
    const ids = new Set(SEED_EXERCISES.map((e) => e.id));
    for (const r of SEED_ROUTINES) for (const it of r.items) expect(ids.has(it.exerciseId), it.exerciseId).toBe(true);
    expect(SEED_ROUTINES.map((r) => r.items.length)).toEqual([6, 6, 7, 5]);
    expect(SEED_ROUTINES[0].items[0]).toMatchObject({ warmupSets: 1, workSets: 3 });
    expect(SEED_ROUTINES[2].items[6].optional).toBe(true);
  });

  it('se cargan una sola vez y no vuelven si se borran', async () => {
    await seedRoutinesOnce();
    await seedRoutinesOnce();
    expect(await getAllRoutines()).toHaveLength(4);
    expect((await getDirty()).routines).toHaveLength(0); // las semillas no se suben
    expect((await getSettings()).routinesSeeded).toBe(true);
    await deleteRoutine('r-martes');
    await seedRoutinesOnce();
    expect((await getAllRoutines()).map((r) => r.id)).toEqual(['r-lunes', 'r-miercoles', 'r-jueves']);
  });

  it('editar una rutina la guarda y queda pendiente de sincronizar', async () => {
    await seedRoutinesOnce();
    const [lunes] = await getAllRoutines();
    await saveRoutine({ ...lunes, items: lunes.items.map((it) => ({ ...it, targetReps: '8-10' })) });
    expect((await getAllRoutines())[0].items[0].targetReps).toBe('8-10');
    expect((await getDirty()).routines).toHaveLength(1);
  });

  it('una sesión desde la rutina respeta calentamiento y precarga la última vez', () => {
    const prev: Session = {
      id: 'p', status: 'done', type: 'gym', title: '', startedAt: 10, notes: '', updatedAt: 10,
      exercises: [{ id: 'x', exerciseId: 'lib-sentadilla', restSec: 150, notes: '', sets: [
        blankSet({ kind: 'warmup', weight: 20, reps: 12, done: true }),
        blankSet({ weight: 50, reps: 8, done: true }), blankSet({ weight: 52.5, reps: 8, done: true }),
      ] }],
    };
    const [sq, hip] = exercisesFromRoutine(SEED_ROUTINES[0].items.slice(0, 2), [prev], 90);
    expect(sq.sets.map((s) => [s.kind, s.weight, s.reps, s.done])).toEqual([
      ['warmup', 20, 12, false], ['work', 50, 8, false], ['work', 52.5, 8, false], ['work', 52.5, 8, false],
    ]);
    expect(sq.restSec).toBe(150);
    expect(hip.sets).toHaveLength(3);
    expect(hip.sets.every((s) => s.weight === null && s.reps === null)).toBe(true);
    expect(hip.restSec).toBe(90);
  });
});
