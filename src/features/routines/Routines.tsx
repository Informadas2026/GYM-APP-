import { useState } from 'react';
import { useAppData } from '../../state';
import type { Routine } from '../../domain/types';
import { exercisesFromRoutine } from '../../domain/calc';
import { muscleName } from '../../domain/muscles';
import { getActiveSession, getAllSessions, startSession } from '../../data/repo';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { RoutineEditor, newRoutine } from './RoutineEditor';

const TONES = ['bg-lav', 'bg-paper', 'bg-lime'];
export const todayWeekday = () => ((new Date().getDay() + 6) % 7) + 1;

export async function startFromRoutine(r: Routine, include: Set<string>, defaultRestSec: number) {
  if (await getActiveSession()) return;
  const sessions = await getAllSessions();
  const items = r.items.filter((it) => include.has(it.id));
  await startSession({ routineId: r.id, title: r.name, exercises: exercisesFromRoutine(items, sessions.filter((x) => x.status === 'done'), defaultRestSec) });
}

export function RoutineList() {
  const { routines, exById } = useAppData();
  const [open, setOpen] = useState<Routine | null>(null);
  const [editing, setEditing] = useState<Routine | null>(null);
  const today = todayWeekday();
  const sorted = [...routines].sort((a, b) => (a.weekday === today ? -1 : b.weekday === today ? 1 : a.order - b.order));

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-[20px] font-semibold">Tus rutinas</h2>
        <button onClick={() => setEditing(newRoutine(routines.length + 1))} className="flex h-10 items-center gap-1.5 rounded-full bg-card2 px-4 text-sm font-semibold">
          <Icon name="plus" size={16} /> Nueva
        </button>
      </div>
      {routines.length === 0 && <p className="rounded-[28px] bg-card p-6 text-muted ring-1 ring-line">Aún no tienes rutinas. Crea una para empezar tus sesiones con los ejercicios ya puestos.</p>}
      <ul className="space-y-3">
        {sorted.map((r, i) => {
          const muscles = [...new Set(r.items.map((it) => exById.get(it.exerciseId)?.primary).filter(Boolean))].slice(0, 3).map((m) => muscleName(m!));
          const isToday = r.weekday === today;
          return (
            <li key={r.id}>
              <button onClick={() => setOpen(r)} className={`relative flex w-full items-center gap-3 rounded-[32px] p-5 text-left text-[#131313] ${TONES[i % 3]}`}>
                <span className="min-w-0 flex-1">
                  {isToday && <span className="mb-2 inline-block rounded-full bg-[#131313] px-3 py-1 text-[12px] font-semibold text-white">Hoy toca</span>}
                  <span className="block font-display text-[19px] font-semibold leading-tight">{r.name}</span>
                  <span className="mt-1 block text-[14px] font-medium opacity-65">{r.items.length} ejercicios · {muscles.join(' / ')}</span>
                </span>
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#131313] text-white"><Icon name="next" /></span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <RoutineSheet routine={routines.find((r) => r.id === open.id) ?? open} onClose={() => setOpen(null)} onEdit={(r) => { setOpen(null); setEditing(r); }} />}
      {editing && <RoutineEditor routine={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function RoutineSheet({ routine, onClose, onEdit }: { routine: Routine; onClose: () => void; onEdit: (r: Routine) => void }) {
  const { exById, settings, active } = useAppData();
  const [include, setInclude] = useState(() => new Set(routine.items.filter((it) => !it.optional).map((it) => it.id)));
  const toggle = (id: string) => setInclude((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Sheet open onClose={onClose} title={routine.name} full>
      <p className="mb-4 text-[14px] text-muted">Marca lo que vas a hacer hoy. Los pesos se rellenan con los de tu última sesión de cada ejercicio.</p>
      <ul className="space-y-2">
        {routine.items.map((it) => {
          const ex = exById.get(it.exerciseId);
          const on = include.has(it.id);
          return (
            <li key={it.id}>
              <button onClick={() => toggle(it.id)} aria-pressed={on} className={`flex w-full items-center gap-3 rounded-[24px] p-4 text-left ring-1 ring-line ${on ? 'bg-card' : 'bg-card opacity-55'}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${on ? 'bg-lime text-lime-ink' : 'bg-card2 text-muted'}`}><Icon name={on ? 'check' : 'plus'} size={16} stroke={2.6} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{ex?.name ?? 'Ejercicio eliminado'}{it.optional ? <span className="ml-2 rounded-full bg-lav px-2 py-0.5 text-[11px] font-bold text-lav-ink">opcional</span> : null}</span>
                  <span className="block text-[13px] text-muted">
                    {it.warmupSets > 0 ? `${it.warmupSets} calent. + ` : ''}{it.workSets} {it.workSets === 1 ? 'serie' : 'series'}{it.targetReps ? ` × ${it.targetReps} reps` : ''}{it.note ? ` · ${it.note}` : ''}{it.groupId ? ' · superserie' : ''}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {active ? (
        <p className="mt-5 rounded-[20px] bg-card2 p-4 text-[14px]">Ya tienes un entrenamiento en curso. Termínalo o descártalo para empezar esta rutina.</p>
      ) : (
        <button disabled={include.size === 0} onClick={async () => { await startFromRoutine(routine, include, settings.defaultRestSec); onClose(); }}
          className="mt-5 flex h-16 w-full items-center justify-between rounded-full bg-pill pl-2 pr-6 text-pill-fg disabled:opacity-40">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-lime text-lime-ink"><Icon name="play" size={20} /></span>
          <span className="font-semibold">Empezar {include.size} {include.size === 1 ? 'ejercicio' : 'ejercicios'}</span>
          <span className="tracking-[-0.2em] opacity-60">›››</span>
        </button>
      )}
      <button onClick={() => onEdit(routine)} className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-card2 font-semibold">
        <Icon name="edit" size={18} /> Editar rutina
      </button>
    </Sheet>
  );
}
