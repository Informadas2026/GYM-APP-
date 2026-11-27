import { useState } from 'react';
import { useAppData } from '../../state';
import type { Session } from '../../domain/types';
import { cap, formatKg, sessionDoneSets, sessionDurationMin } from '../../domain/calc';
import { Icon } from '../../ui/Icon';
import { ACTIVITY, FEELINGS, cardioSummary } from '../cardio/CardioForm';

/** Resumen de un día, desplegado en el propio Inicio. Si hubo varias sesiones, se cambia con pestañas. */
export function DayCard({ day, sessions, onOpen, onClose }: { day: number; sessions: Session[]; onOpen: (id: string) => void; onClose: () => void }) {
  const { exById } = useAppData();
  const [idx, setIdx] = useState(0);
  const s = sessions[Math.min(idx, sessions.length - 1)];
  const gym = s?.type === 'gym';
  const title = cap(new Date(day).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));

  return (
    <section className={`anim-rise relative z-0 mt-3 rounded-[36px] p-6 ${gym ? 'bg-lav text-lav-ink' : 'bg-paper text-paper-ink'}`} aria-label={`Resumen del ${title}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold opacity-60">{title}</p>
          <h2 className="font-display text-[22px] font-semibold leading-tight">{s ? s.title || (gym ? 'Entrenamiento' : ACTIVITY[s.type as keyof typeof ACTIVITY]) : 'Sin entreno'}</h2>
        </div>
        <button onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#131313]/10" aria-label="Cerrar resumen del día"><Icon name="x" size={18} /></button>
      </div>

      {sessions.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="tablist">
          {sessions.map((x, i) => (
            <button key={x.id} role="tab" aria-selected={i === idx} onClick={() => setIdx(i)}
              className={`h-9 rounded-full px-3.5 text-[13px] font-semibold ${i === idx ? 'bg-[#131313] text-white' : 'bg-white/60'}`}>
              {x.type === 'gym' ? (x.title || 'Gimnasio') : ACTIVITY[x.type as keyof typeof ACTIVITY]}
            </button>
          ))}
        </div>
      )}

      {!s ? (
        <p className="mt-3 text-[15px] opacity-70">Este día no registraste ningún entrenamiento.</p>
      ) : gym ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Mini label="Tiempo" value={`${sessionDurationMin(s)} min`} />
            <Mini label="Series" value={String(sessionDoneSets(s))} />
            <Mini label="Ejercicios" value={String(s.exercises.length)} />
          </div>
          <ul className="mt-4 divide-y divide-black/10">
            {s.exercises.map((e) => {
              const done = e.sets.filter((x) => x.done && x.kind !== 'warmup' && (x.reps ?? 0) > 0);
              return (
                <li key={e.id} className="py-2.5">
                  <p className="font-semibold leading-tight">{exById.get(e.exerciseId)?.name ?? 'Ejercicio eliminado'}{e.groupId ? <span className="ml-1.5 text-[11px] font-bold uppercase opacity-50">superserie</span> : null}</p>
                  <p className="mt-0.5 text-[13px] opacity-70">
                    {done.length ? done.map((x) => `${x.kind === 'drop' ? 'D ' : ''}${formatKg(x.weight ?? 0)}×${x.reps}`).join(' · ') : 'Sin series hechas'}
                  </p>
                </li>
              );
            })}
          </ul>
          {s.notes && <p className="mt-2 whitespace-pre-wrap text-[14px] opacity-75">{s.notes}</p>}
        </>
      ) : (
        <>
          <p className="mt-4 font-display text-[24px] font-semibold leading-tight">{cardioSummary(s) || '—'}</p>
          <p className="mt-1 text-[14px] opacity-70">
            {[s.cardio?.elevationM != null && `${s.cardio.elevationM} m desnivel`, s.cardio?.avgHr != null && `${s.cardio.avgHr} ppm`, s.cardio?.feeling && `Sensaciones: ${FEELINGS[s.cardio.feeling - 1]}`].filter(Boolean).join(' · ')}
          </p>
        </>
      )}

      {s && (
        <button onClick={() => onOpen(s.id)} className="mt-5 flex h-12 w-full items-center justify-between rounded-full bg-[#131313] pl-5 pr-2 text-white">
          <span className="font-semibold">Ver completo o editar</span>
          <span className="grid h-9 w-9 place-items-center rounded-full bg-lime text-lime-ink"><Icon name="next" size={18} /></span>
        </button>
      )}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-white/55 px-3 py-2">
      <p className="text-[10.5px] font-bold uppercase tracking-wider opacity-60">{label}</p>
      <p className="font-display text-[16px] font-semibold">{value}</p>
    </div>
  );
}
