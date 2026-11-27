import { useMemo, useState } from 'react';
import type { Equipment, Exercise, MuscleId, Session } from '../../domain/types';
import { MUSCLES, muscleName } from '../../domain/muscles';
import { saveExercise } from '../../data/repo';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const EQUIPMENT: Equipment[] = ['barra', 'mancuernas', 'maquina', 'polea', 'peso corporal', 'kettlebell', 'banda', 'barra Z', 'otro'];
const eqLabel = (e: Equipment) => (e === 'maquina' ? 'máquina' : e);

export function ExercisePicker({ open, onClose, onPick, exercises, sessions, inSession }: {
  open: boolean; onClose: () => void; onPick: (e: Exercise) => void; exercises: Exercise[]; sessions: Session[]; inSession: Set<string>;
}) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleId | null>(null);
  const [creating, setCreating] = useState(false);

  const recentIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of sessions) for (const e of s.exercises) if (!ids.includes(e.exerciseId)) ids.push(e.exerciseId);
    return ids.slice(0, 8);
  }, [sessions]);

  const list = useMemo(() => {
    const nq = norm(q.trim());
    return exercises.filter((e) => (!muscle || e.primary === muscle || e.secondary.includes(muscle)) && (!nq || norm(e.name).includes(nq)));
  }, [exercises, q, muscle]);
  const recent = !q && !muscle ? recentIds.map((id) => exercises.find((e) => e.id === id)).filter(Boolean) as Exercise[] : [];

  const close = () => { setQ(''); setMuscle(null); setCreating(false); onClose(); };
  const pick = (e: Exercise) => { onPick(e); close(); };

  const Row = ({ e }: { e: Exercise }) => (
    <li>
      <button onClick={() => pick(e)} className="flex w-full items-center gap-3 rounded-[24px] bg-card px-4 py-3 text-left ring-1 ring-line active:bg-card2">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{e.name}</span>
          <span className="block truncate text-[13px] text-muted">
            {muscleName(e.primary)} · {eqLabel(e.equipment)}{e.custom ? ' · personalizado' : ''}{inSession.has(e.id) ? ' · ya en la sesión' : ''}
          </span>
        </span>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime text-lime-ink"><Icon name="plus" size={20} /></span>
      </button>
    </li>
  );

  return (
    <Sheet open={open} onClose={close} title={creating ? 'Nuevo ejercicio' : 'Añadir ejercicio'} full>
      {creating ? (
        <CreateExercise initialName={q} onCancel={() => setCreating(false)} onCreated={pick} defaultMuscle={muscle} />
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-1 space-y-3 bg-bg px-1 pb-3">
            <label className="flex h-14 items-center gap-2 rounded-full bg-card px-5 ring-1 ring-line focus-within:ring-2 focus-within:ring-[var(--lav)]">
              <Icon name="search" size={20} className="text-muted" />
              <input id="picker-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ejercicio"
                className="h-full min-w-0 flex-1 bg-transparent text-[16px] outline-none" aria-label="Buscar ejercicio" />
            </label>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              <button onClick={() => setMuscle(null)} className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${!muscle ? 'bg-pill text-pill-fg' : 'bg-card2'}`}>Todos</button>
              {MUSCLES.map((m) => (
                <button key={m.id} onClick={() => setMuscle(muscle === m.id ? null : m.id)}
                  className={`h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${muscle === m.id ? 'bg-pill text-pill-fg' : 'bg-card2'}`}>{m.name}</button>
              ))}
            </div>
          </div>
          {recent.length > 0 && (
            <>
              <h3 className="mb-2 mt-1 text-xs font-bold uppercase tracking-wider text-muted">Recientes</h3>
              <ul className="mb-5 space-y-2">{recent.map((e) => <Row key={e.id} e={e} />)}</ul>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Todos</h3>
            </>
          )}
          <ul className="space-y-2">{list.map((e) => <Row key={e.id} e={e} />)}</ul>
          {list.length === 0 && <p className="py-6 text-center text-muted">No hay ningún ejercicio con ese nombre.</p>}
          <button onClick={() => setCreating(true)} className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lav font-semibold text-lav-ink">
            <Icon name="plus" size={20} /> {q.trim() ? `Crear «${q.trim()}»` : 'Crear ejercicio personalizado'}
          </button>
        </>
      )}
    </Sheet>
  );
}

function CreateExercise({ initialName, defaultMuscle, onCancel, onCreated }: {
  initialName: string; defaultMuscle: MuscleId | null; onCancel: () => void; onCreated: (e: Exercise) => void;
}) {
  const [name, setName] = useState(initialName.trim());
  const [primary, setPrimary] = useState<MuscleId>(defaultMuscle ?? 'pecho');
  const [secondary, setSecondary] = useState<MuscleId[]>([]);
  const [equipment, setEquipment] = useState<Equipment>('mancuernas');
  const [description, setDescription] = useState('');
  const valid = name.trim().length >= 2;

  const chip = (active: boolean) => `h-10 rounded-full px-4 text-sm font-semibold ${active ? 'bg-pill text-pill-fg' : 'bg-card2'}`;
  return (
    <form className="space-y-5" onSubmit={async (ev) => {
      ev.preventDefault();
      if (!valid) return;
      const e = await saveExercise({ name: name.trim(), primary, secondary: secondary.filter((m) => m !== primary), equipment, description: description.trim() || undefined, custom: true });
      onCreated(e);
    }}>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-muted">Nombre</span>
        <input id="new-ex-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2}
          className="h-14 w-full rounded-full bg-card px-5 text-[16px] outline-none ring-1 ring-line focus:ring-2 focus:ring-[var(--lav)]" placeholder="Ej.: Remo en máquina Hammer" />
      </label>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-muted">Músculo principal</legend>
        <div className="flex flex-wrap gap-2">{MUSCLES.map((m) => <button type="button" key={m.id} className={chip(primary === m.id)} onClick={() => setPrimary(m.id)}>{m.name}</button>)}</div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-muted">Músculos secundarios (opcional)</legend>
        <div className="flex flex-wrap gap-2">{MUSCLES.filter((m) => m.id !== primary).map((m) => (
          <button type="button" key={m.id} className={chip(secondary.includes(m.id))}
            onClick={() => setSecondary((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]))}>{m.name}</button>
        ))}</div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-muted">Equipamiento</legend>
        <div className="flex flex-wrap gap-2">{EQUIPMENT.map((e) => <button type="button" key={e} className={chip(equipment === e)} onClick={() => setEquipment(e)}>{eqLabel(e)}</button>)}</div>
      </fieldset>
      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-muted">Descripción (opcional)</span>
        <textarea id="new-ex-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
          className="w-full rounded-3xl bg-card p-4 text-[15px] outline-none ring-1 ring-line focus:ring-2 focus:ring-[var(--lav)]" />
      </label>
      <div className="flex gap-3 pb-2">
        <button type="button" onClick={onCancel} className="h-14 flex-1 rounded-full bg-card2 font-semibold">Volver</button>
        <button type="submit" disabled={!valid} className="h-14 flex-1 rounded-full bg-lime font-semibold text-lime-ink disabled:opacity-40">Crear y añadir</button>
      </div>
    </form>
  );
}
