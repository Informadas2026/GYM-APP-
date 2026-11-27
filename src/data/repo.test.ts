import 'fake-indexeddb/auto';
import { db } from './db';
import { applyIncoming, deleteSession, getActiveSession, getAllExercises, getAllSessions, getDirty, markClean, saveExercise, saveSession, startSession } from './repo';
import { buildBackup, buildSetsCsv, importBackup, parseBackup } from './backup';
import { blankSet } from '../domain/calc';

beforeEach(async () => {
  await Promise.all([db.sessions.clear(), db.exercises.clear(), db.settings.clear()]);
});

describe('persistencia', () => {
  it('una sesión registrada sobrevive y se recupera', async () => {
    const s = await startSession();
    expect((await startSession()).id).toBe(s.id); // no duplica la sesión activa
    await saveSession({ ...s, exercises: [{ id: 'e1', exerciseId: 'lib-sentadilla', restSec: 120, notes: 'buena', sets: [blankSet({ weight: 80, reps: 5, done: true })] }] });
    // Simula recargar la app: nueva conexión a la misma base de datos.
    db.close();
    await db.open();
    const active = await getActiveSession();
    expect(active?.exercises[0].sets[0]).toMatchObject({ weight: 80, reps: 5, done: true });
    await saveSession({ ...active!, status: 'done', endedAt: Date.now() });
    expect(await getActiveSession()).toBeUndefined();
    expect(await getAllSessions()).toHaveLength(1);
  });

  it('borrar deja una marca para sincronizar y oculta la sesión', async () => {
    const s = await startSession();
    await deleteSession(s.id);
    expect(await getAllSessions()).toHaveLength(0);
    const dirty = await getDirty();
    expect(dirty.sessions[0]).toMatchObject({ id: s.id, deleted: true });
  });

  it('los ejercicios personalizados se suman a la biblioteca', async () => {
    const before = (await getAllExercises()).length;
    const e = await saveExercise({ name: 'Remo Hammer', primary: 'espalda', secondary: ['biceps'], equipment: 'maquina', custom: true });
    const all = await getAllExercises();
    expect(all).toHaveLength(before + 1);
    expect(all.find((x) => x.id === e.id)?.name).toBe('Remo Hammer');
  });

  it('marcar como sincronizado respeta cambios posteriores', async () => {
    const s = await startSession();
    const row = (await getDirty()).sessions[0];
    await saveSession({ ...s, notes: 'cambio' }); // cambia mientras se "enviaba"
    await markClean('sessions', s.id, row.updatedAt);
    expect((await getDirty()).sessions).toHaveLength(1);
  });

  it('lo que llega de fuera solo se aplica si es más nuevo', async () => {
    const s = await saveSession({ id: 'w1', status: 'done', type: 'gym', title: 'local', startedAt: 1, notes: '', exercises: [], updatedAt: 0 });
    expect(await applyIncoming('sessions', { ...s, title: 'viejo', updatedAt: s.updatedAt - 10 })).toBe(false);
    expect(await applyIncoming('sessions', { ...s, title: 'nuevo', updatedAt: s.updatedAt + 10 })).toBe(true);
    expect((await getAllSessions())[0].title).toBe('nuevo');
  });

  it('exportar, borrar todo e importar no pierde datos', async () => {
    const s = await startSession();
    await saveSession({ ...s, status: 'done', title: 'Pierna', exercises: [{ id: 'e1', exerciseId: 'lib-prensa', restSec: 90, notes: '', sets: [blankSet({ weight: 120, reps: 10, done: true, effort: 2 })] }] });
    await saveExercise({ name: 'Mi ejercicio', primary: 'gemelos', secondary: [], equipment: 'otro', custom: true });
    const json = JSON.stringify(await buildBackup());
    const csv = await buildSetsCsv();
    expect(csv.split('\n')[1]).toContain('Prensa de piernas');
    expect(csv.split('\n')[1]).toContain(';120;10;2;sí');

    await Promise.all([db.sessions.clear(), db.exercises.clear(), db.settings.clear()]);
    expect(await getAllSessions()).toHaveLength(0);

    const r = await importBackup(parseBackup(json));
    expect(r).toEqual({ sessions: 1, exercises: 1, routines: 0 });
    const back = await getAllSessions();
    expect(back[0]).toMatchObject({ title: 'Pierna' });
    expect(back[0].exercises[0].sets[0]).toMatchObject({ weight: 120, reps: 10, effort: 2 });
    expect((await getAllExercises()).some((e) => e.name === 'Mi ejercicio')).toBe(true);
  });

  it('rechaza archivos que no son copias de la app', () => {
    expect(() => parseBackup('no json')).toThrow('JSON');
    expect(() => parseBackup('{"app":"otra"}')).toThrow('copia de seguridad');
  });
});
