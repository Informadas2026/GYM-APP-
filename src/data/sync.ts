import { applyIncoming, getDirty, markClean, onLocalChange } from './repo';
import type { CloudCollectionRef, CloudDB, CloudUser } from './cloudTypes';

/**
 * Sincronización con la base de datos privada del artefacto en claude.ai.
 * Lo local (IndexedDB) manda siempre: la app funciona sin conexión y,
 * cuando hay nube, se envían los cambios pendientes y se reciben los de otros dispositivos.
 * Cada registro gana por `updatedAt` (el más reciente).
 */

export type SyncState = 'local' | 'connecting' | 'synced' | 'syncing' | 'offline';
type StateListener = (s: SyncState) => void;

const TABLES = ['sessions', 'exercises', 'settings', 'routines'] as const;
type TableName = (typeof TABLES)[number];

let state: SyncState = 'local';
const stateListeners = new Set<StateListener>();
function setState(s: SyncState) {
  state = s;
  stateListeners.forEach((fn) => fn(s));
}
export function onSyncState(fn: StateListener) {
  stateListeners.add(fn);
  fn(state);
  return () => stateListeners.delete(fn);
}

let cols: Record<TableName, CloudCollectionRef> | null = null;
let pushing = false;
let again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function schedulePush(delay = 1200) {
  if (!cols) return;
  clearTimeout(timer);
  timer = setTimeout(push, delay);
}

async function push() {
  if (!cols) return;
  if (pushing) {
    again = true;
    return;
  }
  pushing = true;
  try {
    const dirty = await getDirty();
    const total = TABLES.reduce((a, t) => a + dirty[t].length, 0);
    if (total) setState('syncing');
    for (const table of TABLES) {
      for (const row of dirty[table] as { id: string; updatedAt: number; _dirty?: number }[]) {
        const { _dirty, ...body } = row;
        await cols[table].doc(row.id).set(JSON.parse(JSON.stringify(body)));
        await markClean(table, row.id, row.updatedAt);
      }
    }
    setState('synced');
  } catch (e) {
    console.warn('[sync] envío fallido', e);
    setState('offline');
    clearTimeout(timer);
    timer = setTimeout(push, 15_000);
  } finally {
    pushing = false;
    if (again) {
      again = false;
      schedulePush(300);
    }
  }
}

function isRecord(v: unknown): v is { id: string; updatedAt: number } {
  return !!v && typeof v === 'object' && typeof (v as { id?: unknown }).id === 'string' &&
    typeof (v as { updatedAt?: unknown }).updatedAt === 'number';
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

export async function startSync(): Promise<void> {
  if (typeof window === 'undefined' || !window.claude?.use) return;
  setState('connecting');
  const [cloud, user] = (await Promise.all([
    withTimeout(window.claude.use('db'), 12_000),
    withTimeout(window.claude.use('user'), 12_000),
  ])) as [CloudDB | null, CloudUser | null];
  const uid = user ? await user.id().catch(() => null) : null;
  if (!cloud || !uid) {
    setState('local');
    return;
  }
  // Ruta privada: solo tú puedes leerla, ni siquiera otras personas con acceso a la página.
  const base = cloud.doc(`data/users/${uid}/gym`);
  cols = {
    sessions: base.collection('sessions'),
    exercises: base.collection('exercises'),
    settings: base.collection('settings'),
    routines: base.collection('routines'),
  };
  for (const table of TABLES) {
    cols[table].onSnapshot(
      async (snap) => {
        for (const d of snap.docs) {
          const body = d.data();
          if (isRecord(body)) await applyIncoming(table, body);
        }
        if (!snap.metadata.fromCache && state === 'connecting') setState('synced');
      },
      (err) => {
        console.warn('[sync] suscripción terminada', err.code);
        setState('offline');
      },
    );
  }
  onLocalChange(() => schedulePush());
  schedulePush(500);
}
