import { useEffect, useState } from 'react';
import type { SetEntry } from '../../domain/types';
import { formatKg } from '../../domain/calc';
import { Icon } from '../../ui/Icon';

const parseNum = (s: string): number | null => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) && v >= 0 ? v : null;
};

/** Campo numérico grande que guarda al salir o al pulsar Intro. */
function NumField({ value, placeholder, onCommit, label, decimal }: {
  value: number | null; placeholder?: string; onCommit: (v: number | null) => void; label: string; decimal?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : formatKg(value));
  useEffect(() => setText(value == null ? '' : formatKg(value)), [value]);
  return (
    <input aria-label={label} inputMode={decimal ? 'decimal' : 'numeric'} enterKeyHint="done"
      className="h-12 w-full min-w-0 rounded-2xl field text-center font-display text-[17px] font-semibold text-[#131313] placeholder:text-[#131313]/35 focus:bg-white focus:outline-none"
      value={text} placeholder={placeholder}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(parseNum(text))}
      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()} />
  );
}

export function SetRow({ set, index, workIndex, selected, prev, effortLabel, onSelect, onChange, onToggleDone }: {
  set: SetEntry; index: number; workIndex: number; selected: boolean; prev?: SetEntry;
  effortLabel: string;
  onSelect: () => void; onChange: (patch: Partial<SetEntry>) => void; onToggleDone: () => void;
}) {
  const warm = set.kind === 'warmup';
  const drop = set.kind === 'drop';
  return (
    <div className={`grid grid-cols-[34px_1fr_1fr_44px_52px] items-center gap-1.5 rounded-[22px] p-1 transition-colors ${selected ? 'bg-black/[0.07]' : ''} ${set.done ? 'opacity-100' : ''}`}>
      <button onClick={onSelect} aria-label={`Serie ${index + 1}, opciones`}
        className={`grid h-9 w-9 place-items-center rounded-full font-display text-[13px] font-semibold ${warm ? 'bg-[#131313]/10 text-[#131313]/70' : drop ? 'bg-[#131313] text-white' : 'text-[#131313]'}`}
        title={warm ? 'Calentamiento' : drop ? 'Drop set (descendente)' : undefined}>
        {warm ? 'C' : drop ? 'D' : workIndex}
      </button>
      <NumField label={`Peso serie ${index + 1} en kilos`} decimal value={set.weight}
        placeholder={prev?.weight != null ? formatKg(prev.weight) : 'kg'} onCommit={(v) => onChange({ weight: v })} />
      <NumField label={`Repeticiones serie ${index + 1}`} value={set.reps}
        placeholder={prev?.reps != null ? String(prev.reps) : 'reps'} onCommit={(v) => onChange({ reps: v == null ? null : Math.round(v) })} />
      <button onClick={onSelect} aria-label={`${effortLabel} serie ${index + 1}`}
        className="h-12 rounded-2xl text-center text-[13px] font-semibold text-[#131313]/70">
        {set.effort != null ? set.effort : <span className="text-[#131313]/30">{effortLabel}</span>}
      </button>
      <button onClick={onToggleDone} aria-label={set.done ? `Desmarcar serie ${index + 1}` : `Completar serie ${index + 1}`} aria-pressed={set.done}
        className={`grid h-12 w-12 place-items-center rounded-full transition-colors ${set.done ? 'anim-pop bg-[#131313] text-[var(--lime)]' : 'field text-[#131313]/40'}`}>
        <Icon name="check" size={22} stroke={2.6} />
      </button>
    </div>
  );
}

const RIR = [0, 1, 2, 3, 4, 5];
const RPE = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** Controles rápidos de la serie seleccionada: ± peso, ± reps, esfuerzo, calentamiento y borrar. */
export function SetTools({ set, step, scale, onChange, onDelete }: {
  set: SetEntry; step: number; scale: 'RIR' | 'RPE'; onChange: (p: Partial<SetEntry>) => void; onDelete: () => void;
}) {
  const [hint, setHint] = useState(false);
  const w = set.weight ?? 0;
  const r = set.reps ?? 0;
  const btn = 'h-11 min-w-[44px] rounded-full field px-3 text-[15px] font-bold text-[#131313] active:bg-white';
  const values = scale === 'RIR' ? RIR : RPE;
  return (
    <div className="anim-rise mx-1 mb-2 mt-1 space-y-3 rounded-[22px] bg-black/[0.06] p-3 text-[#131313]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button className={btn} onClick={() => onChange({ weight: Math.max(0, +(w - step).toFixed(2)) })} aria-label={`Quitar ${step} kg`}>−{formatKg(step)}</button>
          <span className="w-8 text-center text-xs font-semibold opacity-60">kg</span>
          <button className={btn} onClick={() => onChange({ weight: +(w + step).toFixed(2) })} aria-label={`Añadir ${step} kg`}>+{formatKg(step)}</button>
        </div>
        <div className="flex items-center gap-1.5">
          <button className={btn} onClick={() => onChange({ reps: Math.max(0, r - 1) })} aria-label="Una repetición menos">−1</button>
          <span className="w-9 text-center text-xs font-semibold opacity-60">reps</span>
          <button className={btn} onClick={() => onChange({ reps: r + 1 })} aria-label="Una repetición más">+1</button>
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold opacity-70">
          <span>{scale} (opcional)</span>
          <button onClick={() => setHint((h) => !h)} aria-expanded={hint} aria-label={`Qué es ${scale}`} className="grid h-7 w-7 place-items-center rounded-full">
            <Icon name="info" size={16} />
          </button>
        </div>
        {hint && (
          <p className="mb-2 text-[13px] leading-snug opacity-80">
            {scale === 'RIR'
              ? 'RIR = repeticiones que te quedaban en reserva. 0: no podías hacer ni una más. 2: podías hacer 2 más. Si no lo sabes, déjalo vacío.'
              : 'RPE = esfuerzo percibido del 6 al 10. 10: máximo esfuerzo, 8: te quedaban unas 2 repeticiones.'}
          </p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <button key={v} onClick={() => onChange({ effort: set.effort === v ? null : v })} aria-pressed={set.effort === v}
              className={`h-10 min-w-[40px] rounded-full px-2.5 text-sm font-bold ${set.effort === v ? 'bg-[#131313] text-white' : 'field'}`}>
              {scale === 'RIR' && v === 5 ? '5+' : String(v).replace('.', ',')}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold opacity-70">Tipo de serie</p>
        <div className="flex flex-wrap gap-1.5">
          {([['work', 'Normal'], ['warmup', 'Calentamiento'], ['drop', 'Drop set']] as const).map(([k, l]) => (
            <button key={k} onClick={() => onChange({ kind: k })} aria-pressed={set.kind === k}
              className={`h-10 rounded-full px-3.5 text-sm font-semibold ${set.kind === k ? 'bg-[#131313] text-white' : 'field'}`}>{l}</button>
          ))}
          <button onClick={onDelete} className="ml-auto flex h-10 items-center gap-1.5 rounded-full field px-3.5 text-sm font-semibold">
            <Icon name="trash" size={16} /> Borrar
          </button>
        </div>
      </div>
    </div>
  );
}
