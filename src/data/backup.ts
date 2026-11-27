import { db } from './db';
import { applyIncoming, getAllExercises, getAllRoutines, getAllSessions, getSettings } from './repo';
import type { Exercise, Routine, Session, Settings } from '../domain/types';
import { sessionDurationMin } from '../domain/calc';

export interface Backup {
  app: 'cuaderno-fuerza';
  schema: 1;
  exportedAt: string;
  sessions: Session[];
  exercises: Exercise[];
  settings: Settings;
  routines?: Routine[];
}

export async function buildBackup(): Promise<Backup> {
  const [sessions, exercises, settings, routines] = await Promise.all([getAllSessions(), getAllExercises(), getSettings(), getAllRoutines()]);
  return {
    routines,
    app: 'cuaderno-fuerza',
    schema: 1,
    exportedAt: new Date().toISOString(),
    sessions: sessions.sort((a, b) => a.startedAt - b.startedAt),
    exercises: exercises.filter((e) => e.custom),
    settings,
  };
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const b = data as Partial<Backup>;
  if (!b || b.app !== 'cuaderno-fuerza' || !Array.isArray(b.sessions) || !Array.isArray(b.exercises)) {
    throw new Error('El archivo no es una copia de seguridad de esta app.');
  }
  for (const s of b.sessions) {
    if (typeof s?.id !== 'string' || typeof s.startedAt !== 'number' || !Array.isArray(s.exercises)) {
      throw new Error('La copia tiene una sesión con formato incorrecto.');
    }
  }
  return b as Backup;
}

/** Fusiona la copia con lo que hay: para cada registro gana el más reciente. */
export async function importBackup(b: Backup): Promise<{ sessions: number; exercises: number; routines: number }> {
  let sessions = 0;
  let exercises = 0;
  let routines = 0;
  for (const r of b.routines ?? []) if (await applyIncoming('routines', r, true)) routines++;
  for (const s of b.sessions) if (await applyIncoming('sessions', s, true)) sessions++;
  for (const e of b.exercises) if (await applyIncoming('exercises', { ...e, custom: true }, true)) exercises++;
  if (b.settings) await applyIncoming('settings', { ...b.settings, id: 'settings' }, true);
  return { sessions, exercises, routines };
}

const csvCell = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Una fila por serie: lo más cómodo para abrir en una hoja de cálculo. */
export async function buildSetsCsv(): Promise<string> {
  const [sessions, exercises, settings] = await Promise.all([getAllSessions(), getAllExercises(), getSettings()]);
  const names = new Map(exercises.map((e) => [e.id, e.name]));
  const header = ['fecha', 'sesion_id', 'duracion_min', 'ejercicio', 'serie', 'tipo', 'peso_kg', 'repeticiones', settings.effortScale.toLowerCase(), 'completada'];
  const rows = [header.join(';')];
  for (const s of sessions.sort((a, b) => a.startedAt - b.startedAt)) {
    const date = new Date(s.startedAt).toISOString().slice(0, 16).replace('T', ' ');
    for (const ex of s.exercises) {
      ex.sets.forEach((set, i) => {
        rows.push([
          date, s.id, sessionDurationMin(s), names.get(ex.exerciseId) ?? ex.exerciseId, i + 1,
          set.kind === 'warmup' ? 'calentamiento' : 'efectiva',
          set.weight == null ? '' : String(set.weight).replace('.', ','), set.reps ?? '', set.effort ?? '', set.done ? 'sí' : 'no',
        ].map(csvCell).join(';'));
      });
    }
  }
  return rows.join('\n');
}

export async function countRecords() {
  return { sessions: await db.sessions.filter((s) => !s.deleted).count() };
}
