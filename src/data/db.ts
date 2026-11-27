import Dexie, { type Table } from 'dexie';
import type { Exercise, Routine, Session, Settings } from '../domain/types';

/** Registro local con marca de pendiente de sincronizar. */
export type Local<T> = T & { _dirty?: 0 | 1 };

export class GymDB extends Dexie {
  sessions!: Table<Local<Session>, string>;
  exercises!: Table<Local<Exercise>, string>;
  settings!: Table<Local<Settings>, string>;
  routines!: Table<Local<Routine>, string>;

  constructor(name = 'cuaderno-fuerza') {
    super(name);
    // Versión 1 del esquema. Las migraciones futuras se añaden con this.version(2)...
    this.version(1).stores({
      sessions: 'id, status, startedAt, updatedAt, _dirty',
      exercises: 'id, primary, custom, updatedAt, _dirty',
      settings: 'id, _dirty',
    });
    // Versión 2: rutinas.
    this.version(2).stores({ routines: 'id, order, updatedAt, _dirty' });
  }
}

export const db = new GymDB();
