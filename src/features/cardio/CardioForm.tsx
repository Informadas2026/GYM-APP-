import { useState } from 'react';
import type { ActivityType, Session } from '../../domain/types';
import { fmtDuration, fmtPace, paceFrom, parseClock } from '../../domain/calc';
import { newId } from '../../domain/ids';
import { saveSession } from '../../data/repo';
import { Sheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';

export const ACTIVITY: Record<Exclude<ActivityType, 'gym'>, string> = { running: 'Running', ciclismo: 'Ciclismo', senderismo: 'Senderismo' };
export const FEELINGS = ['Muy mal', 'Mal', 'Normal', 'Bien', 'Genial'];

const toLocalInput = (t: number) => {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const num = (s: string) => { const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) && v >= 0 ? v : undefined; };
const str = (v?: number) => (v == null ? '' : String(v).replace('.', ','));

/** Formulario de actividad de cardio con los datos que da Strava. Sirve para crear y para editar. */
export function CardioForm({ session, onClose, onSaved }: { session?: Session; onClose: () => void; onSaved?: (id: string) => void }) {
  const c = session?.cardio ?? {};
  const [type, setType] = useState<Exclude<ActivityType, 'gym'>>((session?.type as Exclude<ActivityType, 'gym'>) ?? 'running');
  const [when, setWhen] = useState(toLocalInput(session?.startedAt ?? Date.now()));
  const [km, setKm] = useState(str(c.distanceKm));
  const [dur, setDur] = useState(c.durationSec ? fmtDuration(c.durationSec) : '');
  const [pace, setPace] = useState(c.paceSecPerKm ? fmtPace(c.paceSecPerKm) : '');
  const [paceTouched, setPaceTouched] = useState(!!c.paceSecPerKm && c.paceSecPerKm !== paceFrom(c.durationSec, c.distanceKm));
  const [elev, setElev] = useState(str(c.elevationM));
  const [hr, setHr] = useState(str(c.avgHr));
  const [kcal, setKcal] = useState(str(c.calories));
  const [feeling, setFeeling] = useState<number | undefined>(c.feeling);
  const [notes, setNotes] = useState(session?.notes ?? '');
  const [title, setTitle] = useState(session?.title ?? '');

  const durationSec = parseClock(dur);
  const distanceKm = num(km);
  const autoPace = paceFrom(durationSec, distanceKm);
  const shownPace = paceTouched ? pace : autoPace ? fmtPace(autoPace) : '';
  const valid = !!durationSec || !!distanceKm;

  const save = async () => {
    const startedAt = new Date(when).getTime();
    const s = await saveSession({
      id: session?.id ?? newId('c'),
      status: 'done',
      type,
      title: title.trim(),
      startedAt: Number.isFinite(startedAt) ? startedAt : Date.now(),
      durationMin: durationSec ? Math.round(durationSec / 60) : 0,
      notes: notes.trim(),
      exercises: [],
      cardio: {
        distanceKm,
        durationSec,
        paceSecPerKm: paceTouched ? parseClock(pace) : autoPace,
        elevationM: num(elev),
        avgHr: num(hr),
        calories: num(kcal),
        feeling,
      },
      updatedAt: 0,
    });
    onSaved?.(s.id);
    onClose();
  };

  const box = 'rounded-[24px] bg-card px-4 py-2 ring-1 ring-line';
  const lab = 'block text-[11px] font-bold uppercase tracking-wider text-muted';
  const inp = 'w-full min-w-0 bg-transparent py-1 font-display text-[18px] font-semibold outline-none placeholder:text-muted/50';

  return (
    <Sheet open onClose={onClose} title={session ? 'Editar actividad' : 'Registrar actividad'} full>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {Object.entries(ACTIVITY).map(([k, l]) => (
            <button key={k} onClick={() => setType(k as typeof type)} aria-pressed={type === k}
              className={`h-11 rounded-full px-4 text-sm font-semibold ${type === k ? 'bg-pill text-pill-fg' : 'bg-card2'}`}>{l}</button>
          ))}
        </div>
        <p className="text-[14px] text-muted">Copia los datos de tu actividad en Strava. Solo hacen falta la duración o la distancia; el ritmo se calcula solo.</p>
        <div className="grid grid-cols-2 gap-2">
          <label className={box}><span className={lab}>Distancia (km)</span>
            <input id="c-km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="5,2" className={inp} /></label>
          <label className={box}><span className={lab}>Duración</span>
            <input id="c-dur" inputMode="numeric" value={dur} onChange={(e) => setDur(e.target.value)} placeholder="32:15" className={inp} /></label>
          <label className={box}><span className={lab}>Ritmo medio (/km)</span>
            <input id="c-pace" inputMode="numeric" value={shownPace} onChange={(e) => { setPaceTouched(true); setPace(e.target.value); }} placeholder="6:12" className={inp} /></label>
          <label className={box}><span className={lab}>Desnivel (m)</span>
            <input id="c-elev" inputMode="numeric" value={elev} onChange={(e) => setElev(e.target.value)} placeholder="opcional" className={inp} /></label>
          <label className={box}><span className={lab}>FC media (ppm)</span>
            <input id="c-hr" inputMode="numeric" value={hr} onChange={(e) => setHr(e.target.value)} placeholder="opcional" className={inp} /></label>
          <label className={box}><span className={lab}>Calorías</span>
            <input id="c-kcal" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="opcional" className={inp} /></label>
        </div>
        <p className="-mt-2 text-[12px] text-muted">Duración como en Strava: 45:10 o 1:05:30. Un número solo son minutos.</p>
        <label className={`${box} block`}><span className={lab}>Fecha y hora</span>
          <input id="c-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full min-w-0 bg-transparent py-1 font-semibold outline-none" /></label>
        <div>
          <p className="mb-2 text-sm font-semibold text-muted">Sensaciones</p>
          <div className="flex flex-wrap gap-1.5">
            {FEELINGS.map((f, i) => (
              <button key={f} onClick={() => setFeeling(feeling === i + 1 ? undefined : i + 1)} aria-pressed={feeling === i + 1}
                className={`h-11 rounded-full px-3.5 text-sm font-semibold ${feeling === i + 1 ? 'bg-lav text-lav-ink' : 'bg-card2'}`}>{f}</button>
            ))}
          </div>
        </div>
        <input id="c-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nombre (opcional): Rodaje suave, Series…"
          className="h-14 w-full rounded-full bg-card px-5 outline-none ring-1 ring-line focus:ring-2 focus:ring-[var(--lav)]" />
        <textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notas"
          className="w-full rounded-3xl bg-card p-4 outline-none ring-1 ring-line focus:ring-2 focus:ring-[var(--lav)]" />
        <button disabled={!valid} onClick={save} className="h-14 w-full rounded-full bg-lime font-semibold text-lime-ink disabled:opacity-40">Guardar</button>
      </div>
    </Sheet>
  );
}

export function CardioButton({ onSaved, className = '' }: { onSaved?: (id: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={`flex h-14 w-full items-center justify-center gap-2 rounded-full bg-lav font-semibold text-lav-ink ${className}`}>
        <Icon name="run" size={20} /> Registrar carrera u otra actividad
      </button>
      {open && <CardioForm onClose={() => setOpen(false)} onSaved={onSaved} />}
    </>
  );
}

export function cardioSummary(s: Session): string {
  const c = s.cardio ?? {};
  const parts = [] as string[];
  if (c.distanceKm) parts.push(`${String(Math.round(c.distanceKm * 100) / 100).replace('.', ',')} km`);
  if (c.durationSec) parts.push(fmtDuration(c.durationSec));
  if (c.paceSecPerKm) parts.push(`${fmtPace(c.paceSecPerKm)} /km`);
  return parts.join(' · ');
}
