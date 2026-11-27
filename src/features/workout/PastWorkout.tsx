import { useState } from 'react';
import { useAppData } from '../../state';
import { exercisesFromRoutine, startOfWeek, cap } from '../../domain/calc';
import { newId } from '../../domain/ids';
import { saveSession } from '../../data/repo';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';

const DAY = 86_400_000;
const toDateInput = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Registrar un entrenamiento ya hecho: se crea con su fecha y se abre para rellenar las series, sin temporizador. */
export function PastWorkoutButton({ onCreated, className = '' }: { onCreated: (id: string) => void; className?: string }) {
  const { routines, sessions, settings } = useAppData();
  const [open, setOpen] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ws = startOfWeek(today.getTime());
  const weekDays = Array.from({ length: Math.round((today.getTime() - ws) / DAY) + 1 }, (_, i) => ws + i * DAY);
  const [day, setDay] = useState<number>(weekDays[0]);
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [time, setTime] = useState('18:00');
  const [minutes, setMinutes] = useState('60');

  const pickDay = (t: number) => {
    setDay(t);
    const wd = ((new Date(t).getDay() + 6) % 7) + 1;
    const match = routines.find((r) => r.weekday === wd);
    if (match) setRoutineId(match.id);
  };

  const create = async () => {
    const [h, m] = time.split(':').map(Number);
    const startedAt = day + ((h || 0) * 60 + (m || 0)) * 60_000;
    const r = routines.find((x) => x.id === routineId);
    const done = sessions.filter((s) => s.status === 'done');
    const s = await saveSession({
      id: newId('w'), status: 'done', type: 'gym', title: r?.name ?? '', startedAt,
      durationMin: Math.max(0, parseInt(minutes, 10) || 0), notes: '', routineId: r?.id,
      exercises: r ? exercisesFromRoutine(r.items.filter((it) => !it.optional), done.filter((x) => x.startedAt < startedAt), settings.defaultRestSec) : [],
      updatedAt: 0,
    });
    setOpen(false);
    onCreated(s.id);
  };

  return (
    <>
      <button onClick={() => { pickDay(weekDays[0]); setOpen(true); }} className={`flex h-14 w-full items-center justify-center gap-2 rounded-full bg-card2 font-semibold ${className}`}>
        <Icon name="calendar" size={20} /> Registrar entreno pasado
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Entreno pasado" full>
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-semibold text-muted">¿Qué día?</p>
            <div className="flex flex-wrap gap-2">
              {weekDays.map((t) => (
                <button key={t} onClick={() => pickDay(t)} aria-pressed={day === t}
                  className={`h-12 rounded-full px-4 text-sm font-semibold ${day === t ? 'bg-pill text-pill-fg' : 'bg-card2'}`}>
                  {cap(new Date(t).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }).replace('.', ''))}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-3 text-sm text-muted">
              Otra fecha
              <input id="past-date" type="date" value={toDateInput(day)} max={toDateInput(Date.now())}
                onChange={(e) => { const [y, mo, d] = e.target.value.split('-').map(Number); if (y) pickDay(new Date(y, mo - 1, d).getTime()); }}
                className="h-11 rounded-full bg-card px-4 text-fg ring-1 ring-line" />
            </label>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-muted">Rutina</p>
            <div className="flex flex-wrap gap-2">
              {routines.map((r) => (
                <button key={r.id} onClick={() => setRoutineId(r.id)} aria-pressed={routineId === r.id}
                  className={`h-12 rounded-full px-4 text-sm font-semibold ${routineId === r.id ? 'bg-lav text-lav-ink' : 'bg-card2'}`}>{r.name}</button>
              ))}
              <button onClick={() => setRoutineId(null)} aria-pressed={routineId === null}
                className={`h-12 rounded-full px-4 text-sm font-semibold ${routineId === null ? 'bg-lav text-lav-ink' : 'bg-card2'}`}>Sin rutina</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="rounded-[24px] bg-card px-4 py-2 ring-1 ring-line">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Hora de inicio</span>
              <input id="past-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-transparent py-1 font-semibold outline-none" />
            </label>
            <label className="rounded-[24px] bg-card px-4 py-2 ring-1 ring-line">
              <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">Minutos</span>
              <input id="past-minutes" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="w-full bg-transparent py-1 font-semibold outline-none" />
            </label>
          </div>
          <p className="text-[14px] text-muted">Se abrirá la sesión para que escribas pesos y repeticiones. Marca ✓ en las series que hiciste: las que no marques no cuentan.</p>
          <button onClick={create} className="h-14 w-full rounded-full bg-lime font-semibold text-lime-ink">Crear y rellenar series</button>
        </div>
      </Sheet>
    </>
  );
}
