import { useState } from 'react';
import type { Exercise, SessionExercise, SetEntry, Settings } from '../../domain/types';
import { blankSet, formatKg, type LastPerformance } from '../../domain/calc';
import { muscleName } from '../../domain/muscles';
import { Ring } from '../../ui/Ring';
import { Icon } from '../../ui/Icon';
import { Segmented, Sheet } from '../../ui/Sheet';
import { SetRow, SetTools } from './SetRow';

const TONES = ['bg-lav', 'bg-paper', 'bg-lime'];

function dateShort(t: number) {
  return new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function ExerciseCard({ item, exercise, last, tone, expanded, settings, onExpand, onChange, onRemove, onSetDone, autoDone, link }: {
  item: SessionExercise; exercise?: Exercise; last: LastPerformance | null; tone: number; expanded: boolean; settings: Settings;
  onExpand: () => void; onChange: (next: SessionExercise) => void; onRemove: () => void;
  onSetDone: (index: number) => void;
  /** Al corregir una sesión pasada, escribir datos marca la serie como hecha. */
  autoDone?: boolean;
  link?: { canLinkNext: boolean; linked: boolean; onLink: () => void; onUnlink: () => void };
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const workTotal = item.sets.filter((s) => s.kind === 'work').length;
  const workDone = item.sets.filter((s) => s.kind === 'work' && s.done).length;
  const current = selected ?? item.sets.find((s) => !s.done)?.id ?? null;

  const patchSet = (id: string, patch: Partial<SetEntry>) =>
    onChange({ ...item, sets: item.sets.map((s) => {
      if (s.id !== id) return s;
      const next: SetEntry = { ...s, ...patch, auto: false };
      const dataChange = 'weight' in patch || 'reps' in patch;
      if (dataChange) next.edited = true;
      if (autoDone && dataChange && !next.done && (next.reps ?? 0) > 0) { next.done = true; next.doneAt = Date.now(); }
      return next;
    }) });
  const addSet = (kind: SetEntry['kind'] = 'work') => {
    const lastSet = item.sets[item.sets.length - 1];
    const w = lastSet?.weight ?? null;
    // Un drop set baja el peso un 20 % (redondeado al salto de peso) y deja las repeticiones por rellenar.
    const weight = kind === 'drop' && w ? Math.max(0, Math.round((w * 0.8) / settings.weightStep) * settings.weightStep) : w;
    const s = blankSet({ kind, weight, reps: kind === 'drop' ? null : lastSet?.reps ?? null });
    onChange({ ...item, sets: [...item.sets, s] });
    setSelected(kind === 'drop' ? s.id : null);
  };

  let workCounter = 0;
  const name = exercise?.name ?? 'Ejercicio eliminado';

  return (
    <section className={`anim-rise relative rounded-[32px] ${TONES[tone % 3]} text-[#131313]`}>
      {/* Pestaña superior en forma de burbuja, como en las referencias */}
      <span className="absolute left-1/2 top-0 h-1.5 w-8 -translate-x-1/2 translate-y-2 rounded-full bg-[#131313]/15" aria-hidden="true" />
      <div className="flex items-start gap-3 p-5 pb-3">
        <button className="min-w-0 flex-1 text-left" onClick={onExpand} aria-expanded={expanded}>
          <h3 className="font-display text-[19px] font-semibold leading-tight">{name}</h3>
          <p className="mt-1 text-[14px] font-medium opacity-65">
            {workTotal} {workTotal === 1 ? 'serie' : 'series'}{item.targetReps ? ` × ${item.targetReps} reps` : ''}
            {exercise ? ` · ${muscleName(exercise.primary)}` : ''}
          </p>
        </button>
        <Ring done={workDone} total={workTotal} />
      </div>

      {expanded && (
        <div className="px-3 pb-4">
          <div className="mx-2 mb-3 flex items-center justify-between gap-2 text-[13px]">
            <p className="min-w-0 truncate font-medium opacity-70">
              {last
                ? `Última vez (${dateShort(last.date)}): ${last.sets.filter((s) => s.kind === 'work').map((s) => `${formatKg(s.weight ?? 0)}×${s.reps}`).join(' · ')}`
                : 'Primera vez: se guardará como referencia'}
            </p>
            <button onClick={() => setMenu(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full field" aria-label={`Opciones de ${name}`}>
              <Icon name="more" size={22} stroke={3} />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-[34px_1fr_1fr_44px_52px] gap-1.5 px-1 text-center text-[11px] font-bold uppercase tracking-wider opacity-55">
            <span>Serie</span><span>kg</span><span>Reps</span><span>{settings.effortScale}</span><span>Hecha</span>
          </div>
          <div className="space-y-1">
            {item.sets.map((s, i) => {
              if (s.kind === 'work') workCounter++;
              const prevSet = last?.sets[i];
              return (
                <div key={s.id}>
                  <SetRow set={s} index={i} workIndex={workCounter} selected={current === s.id} prev={prevSet}
                    effortLabel={settings.effortScale}
                    onSelect={() => setSelected(current === s.id && selected ? null : s.id)}
                    onChange={(p) => patchSet(s.id, p)}
                    onToggleDone={() => {
                      if (s.done) patchSet(s.id, { done: false, doneAt: undefined });
                      else { setSelected(null); onSetDone(i); }
                    }} />
                  {current === s.id && (
                    <SetTools set={s} step={settings.weightStep} scale={settings.effortScale}
                      onChange={(p) => patchSet(s.id, p)}
                      onDelete={() => { onChange({ ...item, sets: item.sets.filter((x) => x.id !== s.id) }); setSelected(null); }} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2 px-1">
            <button onClick={() => addSet()} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#131313] font-semibold text-white">
              <Icon name="plus" size={18} /> Serie
            </button>
            <button onClick={() => addSet('drop')} className="flex h-12 items-center gap-1.5 rounded-full field px-4 text-sm font-semibold" aria-label="Añadir drop set">
              <Icon name="plus" size={16} /> Drop
            </button>
            <button onClick={() => setMenu(true)} className="flex h-12 items-center gap-2 rounded-full field px-4 text-sm font-semibold" aria-label="Cambiar descanso">
              <Icon name="timer" size={18} /> {Math.floor(item.restSec / 60)}:{String(item.restSec % 60).padStart(2, '0')}
            </button>
          </div>
          {item.notes && <p className="mx-2 mt-3 whitespace-pre-wrap text-[14px] opacity-75">{item.notes}</p>}
        </div>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title={name}>
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold text-muted">Descanso entre series</p>
            <Segmented label="Descanso" value={item.restSec} onChange={(v) => onChange({ ...item, restSec: v })}
              options={[45, 60, 90, 120, 150, 180, 240].map((v) => ({ value: v, label: v < 60 ? `${v} s` : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` }))} />
          </div>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-muted">Observaciones</span>
            <textarea id={`notes-${item.id}`} rows={3} defaultValue={item.notes}
              onBlur={(e) => onChange({ ...item, notes: e.target.value })}
              placeholder="Técnica, molestias, ajustes de la máquina…"
              className="w-full rounded-3xl bg-card p-4 text-[15px] outline-none ring-1 ring-line focus:ring-2 focus:ring-[var(--lav)]" />
          </label>
          {link && (link.linked || link.canLinkNext) && (
            <div>
              <p className="mb-2 text-sm font-semibold text-muted">Superserie</p>
              {link.linked ? (
                <button onClick={() => { link.onUnlink(); setMenu(false); }} className="h-12 w-full rounded-full bg-card2 font-semibold">Sacar de la superserie</button>
              ) : (
                <button onClick={() => { link.onLink(); setMenu(false); }} className="h-12 w-full rounded-full bg-lav font-semibold text-lav-ink">Hacer superserie con el siguiente</button>
              )}
              <p className="mt-2 text-[13px] text-muted">En una superserie haces una serie de cada ejercicio seguidas y el descanso empieza al terminar la última.</p>
            </div>
          )}
          {exercise?.description && (
            <p className="text-[14px] text-muted">{exercise.description}</p>
          )}
          <button onClick={() => { setMenu(false); onRemove(); }} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-card2 font-semibold text-danger">
            <Icon name="trash" size={18} /> Quitar ejercicio de la sesión
          </button>
        </div>
      </Sheet>
    </section>
  );
}
