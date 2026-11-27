import { db, type Local } from './db';
import { SEED_EXERCISES } from './seedExercises';
import { DEFAULT_SETTINGS, type Exercise, type Routine, type Session, type Settings } from '../domain/types';
import { SEED_ROUTINES } from './seedRoutines';
import { newId } from '../domain/ids';

type Listener = () => void;
const listeners = new Set<Listener>();
/** Avisa a la capa de sincronización de que hay cambios locales. */
export function onLocalChange(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const notify = () => listeners.forEach((fn) => fn());

/** Marca de tiempo siempre creciente: dos guardados seguidos nunca comparten updatedAt. */
let lastStamp = 0;
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

function clean<T extends object>(r: Local<T>): T {
  const { _dirty, ...rest } = r as Local<T> & { _dirty?: unknown };
  return rest as T;
}

export type TableName = 'sessions' | 'exercises' | 'settings' | 'routines';

// ---------- Sesiones ----------

export async function getAllSessions(): Promise<Session[]> {
  const rows = await db.sessions.toArray();
  return rows.filter((s) => !s.deleted).map(clean<Session>);
}

export async function getActiveSession(): Promise<Session | undefined> {
  const rows = await db.sessions.where('status').equals('active').toArray();
  return rows.filter((s) => !s.deleted).map(clean<Session>)[0];
}

export async function saveSession(s: Session): Promise<Session> {
  const row: Local<Session> = { ...s, updatedAt: stamp(), _dirty: 1 };
  await db.sessions.put(row);
  notify();
  return clean(row);
}

export async function startSession(init: Partial<Session> = {}): Promise<Session> {
  const existing = await getActiveSession();
  if (existing) return existing;
  const now = Date.now();
  const s: Session = {
    id: newId('w'),
    status: 'active',
    type: 'gym',
    title: '',
    startedAt: now,
    notes: '',
    exercises: [],
    updatedAt: now,
    ...init,
  };
  return saveSession(s);
}

/** Borrado lógico: queda una marca para que el borrado también llegue a otros dispositivos. */
export async function deleteSession(id: string): Promise<void> {
  const row = await db.sessions.get(id);
  if (!row) return;
  await db.sessions.put({
    id: row.id,
    status: 'done',
    type: row.type,
    title: '',
    startedAt: row.startedAt,
    notes: '',
    exercises: [],
    deleted: true,
    updatedAt: stamp(),
    _dirty: 1,
  });
  notify();
}

// ---------- Ejercicios ----------

export async function getAllExercises(): Promise<Exercise[]> {
  const custom = (await db.exercises.toArray()).map(clean<Exercise>);
  const byId = new Map<string, Exercise>(SEED_EXERCISES.map((e) => [e.id, e]));
  for (const e of custom) byId.set(e.id, e);
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

export async function saveExercise(e: Omit<Exercise, 'id' | 'updatedAt'> & { id?: string }): Promise<Exercise> {
  const row: Local<Exercise> = { ...e, id: e.id ?? newId('x'), updatedAt: stamp(), _dirty: 1 };
  await db.exercises.put(row);
  notify();
  return clean(row);
}

// ---------- Ajustes ----------

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get('settings');
  return row ? { ...DEFAULT_SETTINGS, ...clean(row) } : DEFAULT_SETTINGS;
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const row: Local<Settings> = { ...current, ...patch, id: 'settings', updatedAt: stamp(), _dirty: 1 };
  await db.settings.put(row);
  notify();
  return clean(row);
}

// ---------- Rutinas ----------

export async function getAllRoutines(): Promise<Routine[]> {
  const rows = await db.routines.toArray();
  return rows.filter((r) => !r.deleted).map(clean<Routine>).sort((a, b) => a.order - b.order);
}

export async function saveRoutine(r: Routine): Promise<Routine> {
  const row: Local<Routine> = { ...r, updatedAt: stamp(), _dirty: 1 };
  await db.routines.put(row);
  notify();
  return clean(row);
}

export async function deleteRoutine(id: string): Promise<void> {
  const row = await db.routines.get(id);
  if (!row) return;
  await db.routines.put({ ...row, items: [], deleted: true, updatedAt: stamp(), _dirty: 1 });
  notify();
}

/** Carga las rutinas iniciales una sola vez. Con ids fijos y updatedAt 1, cualquier edición posterior gana. */
export async function seedRoutinesOnce(): Promise<void> {
  const s = await getSettings();
  if (s.routinesSeeded) return;
  await db.transaction('rw', db.routines, async () => {
    for (const r of SEED_ROUTINES) if (!(await db.routines.get(r.id))) await db.routines.put({ ...r, _dirty: 0 }); // no se envía: cada dispositivo la crea igual
  });
  await saveSettings({ routinesSeeded: true });
}

// ---------- Correcciones de datos (una sola vez) ----------

async function fixOnce(id: string, run: () => Promise<void>) {
  const s = await getSettings();
  if (s.fixes?.includes(id)) return;
  await run();
  await saveSettings({ fixes: [...(s.fixes ?? []), id] });
}

export async function applyDataFixes(): Promise<void> {
  // 27/11: el press militar de Olga es con mancuernas.
  await fixOnce('martes-press-mancuernas', async () => {
    const r = await db.routines.get('r-martes');
    if (r && r.items.some((it) => it.exerciseId === 'lib-press-militar')) {
      await saveRoutine({ ...r, items: r.items.map((it) => (it.exerciseId === 'lib-press-militar' ? { ...it, exerciseId: 'lib-press-hombro-mancuernas' } : it)) });
    }
    for (const s of await db.sessions.where('status').equals('done').toArray()) {
      if (s.deleted || s.routineId !== 'r-martes' || !s.exercises.some((e) => e.exerciseId === 'lib-press-militar')) continue;
      await saveSession({ ...s, exercises: s.exercises.map((e) => (e.exerciseId === 'lib-press-militar' ? { ...e, exerciseId: 'lib-press-hombro-mancuernas' } : e)) });
    }
  });
  // 27/11: en sesiones guardadas, las series con repeticiones escritas pero sin ✓ cuentan como hechas.
  await fixOnce('series-sin-marcar', async () => {
    for (const s of await db.sessions.where('status').equals('done').toArray()) {
      if (s.deleted) continue;
      let changed = false;
      const exercises = s.exercises.map((e) => ({ ...e, sets: e.sets.map((x) => {
        if (x.done || x.auto || !((x.reps ?? 0) > 0)) return x;
        changed = true;
        return { ...x, done: true, doneAt: s.startedAt };
      }) }));
      if (changed) await saveSession({ ...s, exercises });
    }
  });
}

// ---------- Utilidades para sincronización y copias ----------

export async function getDirty() {
  const [sessions, exercises, settings, routines] = await Promise.all([
    db.sessions.where('_dirty').equals(1).toArray(),
    db.exercises.where('_dirty').equals(1).toArray(),
    db.settings.where('_dirty').equals(1).toArray(),
    db.routines.where('_dirty').equals(1).toArray(),
  ]);
  return { sessions, exercises, settings, routines };
}

/** Marca como sincronizado solo si nadie lo cambió mientras se enviaba. */
export async function markClean(table: TableName, id: string, updatedAt: number) {
  await db.transaction('rw', db[table], async () => {
    const t = db[table] as unknown as import('dexie').Table<Local<{ id: string; updatedAt: number }>, string>;
    const row = await t.get(id);
    if (row && row.updatedAt === updatedAt) await t.update(id, { _dirty: 0 });
  });
}

/** Aplica un registro que viene de fuera (nube o copia) si es más reciente. Devuelve true si cambió algo. */
export async function applyIncoming<T extends { id: string; updatedAt: number }>(
  table: TableName,
  rec: T,
  markDirty = false,
): Promise<boolean> {
  const t = db[table] as unknown as import('dexie').Table<Local<{ id: string; updatedAt: number }>, string>;
  const changed = await db.transaction('rw', t, async () => {
    const local = await t.get(rec.id);
    if (local && local.updatedAt >= rec.updatedAt) return false;
    await t.put({ ...rec, _dirty: markDirty ? 1 : 0 });
    return true;
  });
  if (changed && markDirty) notify();
  return changed;
}

export async function wipeAll() {
  await Promise.all([db.sessions.clear(), db.exercises.clear(), db.settings.clear(), db.routines.clear()]);
}
