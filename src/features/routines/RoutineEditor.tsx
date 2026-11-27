import { useState } from 'react';
import { useAppData } from '../../state';
import type { Routine, RoutineItem } from '../../domain/types';
import { newId } from '../../domain/ids';
import { deleteRoutine, saveRoutine } from '../../data/repo';
import { ConfirmSheet, Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { ExercisePicker } from '../workout/ExercisePicker';

export const newRoutine = (order: number): Routine => ({ id: newId('r'), name: '', notes: '', items: [], order, updatedAt: 0 });
const DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} className="grid h-10 w-10 place-items-center rounded-full bg-card2" aria-label={`Menos ${label}`}><Icon name="minus" size={16} /></button>
      <span className="w-[74px] text-center text-[13px] leading-tight"><b className="block font-display text-[17px]">{value}</b>{label}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="grid h-10 w-10 place-items-center rounded-full bg-card2" aria-label={`Más ${label}`}><Icon name="plus" size={16} /></button>
    </div>
  );
}

export function RoutineEditor({ routine, onClose }: { routine: Routine; onClose: () => void }) {
  const { exById, exercises, sessions } = useAppData();
  const [draft, setDraft] = useState<Routine>(routine);
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const isNew = routine.updatedAt === 0;
  const setItem = (id: string, patch: Partial<RoutineItem>) => setDraft((d) => ({ ...d, items: d.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const move = (i: number, dir: -1 | 1) => setDraft((d) => {
    const items = [...d.items];
    const j = i + dir;
    if (j < 0 || j >= items.length) return d;
    [items[i], items[j]] = [items[j], items[i]];
    return { ...d, items };
  });
  const valid = draft.name.trim().length > 0 && draft.items.length > 0;
  const linked = (i: number) => !!draft.items[i].groupId && draft.items[i].groupId === draft.items[i + 1]?.groupId;
  const toggleLink = (i: number) => setDraft((d) => {
    const items = d.items.map((x) => ({ ...x }));
    const a = items[i], b = items[i + 1];
    if (!b) return d;
    if (a.groupId && a.groupId === b.groupId) {
      const fresh = newId('g');
      for (let j = i + 1; j < items.length && items[j].groupId === a.groupId; j++) items[j].groupId = fresh;
    } else {
      const gid = a.groupId ?? newId('g');
      const old = b.groupId;
      for (const x of items) if (x === a || x === b || (old && x.groupId === old)) x.groupId = gid;
    }
    // Un grupo de un solo ejercicio no es superserie.
    for (const x of items) if (x.groupId && items.filter((y) => y.groupId === x.groupId).length < 2) x.groupId = undefined;
    return { ...d, items };
  });

  return (
    <Sheet open onClose={onClose} title={isNew ? 'Nueva rutina' : 'Editar rutina'} full>
      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-muted">Nombre</span>
          <input id="routine-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej.: Torso / Pierna, Full Body…"
            className="h-14 w-full rounded-full bg-card px-5 text-[16px] outline-none ring-1 ring-line focus:ring-2 focus:ring-[var(--lav)]" />
        </label>
        <div>
          <p className="mb-2 text-sm font-semibold text-muted">Día de la semana (para sugerirla ese día)</p>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <button key={d} type="button" onClick={() => setDraft({ ...draft, weekday: draft.weekday === i + 1 ? undefined : i + 1 })} aria-pressed={draft.weekday === i + 1}
                className={`h-11 w-11 rounded-full text-sm font-bold ${draft.weekday === i + 1 ? 'bg-pill text-pill-fg' : 'bg-card2'}`}>{d}</button>
            ))}
          </div>
        </div>

        <ul className="space-y-3">
          {draft.items.map((it, i) => (
            <li key={it.id} className="rounded-[28px] bg-card p-4 ring-1 ring-line">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 pt-2 font-semibold">{i + 1}. {exById.get(it.exerciseId)?.name ?? 'Ejercicio eliminado'}</p>
                <button onClick={() => move(i, -1)} disabled={i === 0} className="grid h-10 w-10 place-items-center rounded-full bg-card2 disabled:opacity-30" aria-label="Subir"><Icon name="back" size={16} className="rotate-90" /></button>
                <button onClick={() => move(i, 1)} disabled={i === draft.items.length - 1} className="grid h-10 w-10 place-items-center rounded-full bg-card2 disabled:opacity-30" aria-label="Bajar"><Icon name="back" size={16} className="-rotate-90" /></button>
                <button onClick={() => setDraft({ ...draft, items: draft.items.filter((x) => x.id !== it.id) })} className="grid h-10 w-10 place-items-center rounded-full bg-card2 text-danger" aria-label="Quitar ejercicio"><Icon name="trash" size={16} /></button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <Counter label="efectivas" value={it.workSets} min={1} max={10} onChange={(v) => setItem(it.id, { workSets: v })} />
                <Counter label="calentam." value={it.warmupSets} min={0} max={4} onChange={(v) => setItem(it.id, { warmupSets: v })} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <input aria-label="Repeticiones objetivo" value={it.targetReps ?? ''} onChange={(e) => setItem(it.id, { targetReps: e.target.value || undefined })} placeholder="Reps objetivo (ej. 8-10)"
                  className="h-11 min-w-0 flex-1 rounded-full bg-card2 px-4 text-[15px] outline-none focus:ring-2 focus:ring-[var(--lav)]" />
                <button onClick={() => setItem(it.id, { optional: !it.optional })} aria-pressed={!!it.optional}
                  className={`h-11 rounded-full px-4 text-sm font-semibold ${it.optional ? 'bg-lav text-lav-ink' : 'bg-card2'}`}>Opcional</button>
              </div>
              {i < draft.items.length - 1 && (
                <button onClick={() => toggleLink(i)} aria-pressed={linked(i)}
                  className={`mt-2 h-11 w-full rounded-full text-sm font-semibold ${linked(i) ? 'bg-pill text-pill-fg' : 'bg-card2'}`}>
                  {linked(i) ? 'En superserie con el siguiente ✓' : 'Hacer superserie con el siguiente'}
                </button>
              )}
              <input aria-label="Nota" value={it.note ?? ''} onChange={(e) => setItem(it.id, { note: e.target.value || undefined })} placeholder="Nota (opcional)"
                className="mt-2 h-11 w-full rounded-full bg-card2 px-4 text-[14px] outline-none focus:ring-2 focus:ring-[var(--lav)]" />
            </li>
          ))}
        </ul>
        <button onClick={() => setPicker(true)} className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-card2 font-semibold"><Icon name="plus" size={20} /> Añadir ejercicio</button>

        <div className="flex gap-3">
          {!isNew && <button onClick={() => setConfirm(true)} className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-card2 text-danger" aria-label="Borrar rutina"><Icon name="trash" /></button>}
          <button disabled={!valid} onClick={async () => { await saveRoutine({ ...draft, name: draft.name.trim() }); onClose(); }}
            className="h-14 flex-1 rounded-full bg-lime font-semibold text-lime-ink disabled:opacity-40">Guardar rutina</button>
        </div>
        {!valid && <p className="text-[13px] text-muted">Ponle un nombre y al menos un ejercicio.</p>}
      </div>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} exercises={exercises} sessions={sessions} inSession={new Set(draft.items.map((x) => x.exerciseId))}
        onPick={(e) => setDraft((d) => ({ ...d, items: [...d.items, { id: newId('ri'), exerciseId: e.id, warmupSets: 0, workSets: 3 }] }))} />
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} danger title="¿Borrar la rutina?" body="Tus entrenamientos hechos con ella se conservan en el historial." confirmLabel="Borrar"
        onConfirm={() => { void deleteRoutine(routine.id); onClose(); }} />
    </Sheet>
  );
}
