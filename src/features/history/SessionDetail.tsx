import { useState } from 'react';
import { useAppData } from '../../state';
import { deleteSession } from '../../data/repo';
import { cap, e1rm, formatKg, sessionDoneSets, sessionDurationMin } from '../../domain/calc';
import { muscleName } from '../../domain/muscles';
import { SessionEditor } from '../workout/SessionEditor';
import { ConfirmSheet } from '../../ui/Sheet';
import { Icon } from '../../ui/Icon';
import { ACTIVITY, CardioForm, FEELINGS, cardioSummary } from '../cardio/CardioForm';
import { fmtDuration, fmtPace } from '../../domain/calc';

const TONES = ['bg-lav', 'bg-paper', 'bg-lime'];

export function SessionDetail({ id, onClose, startEditing = false }: { id: string; onClose: () => void; startEditing?: boolean }) {
  const { sessions, exById, settings } = useAppData();
  const [editing, setEditing] = useState(startEditing);
  const [confirm, setConfirm] = useState(false);
  const s = sessions.find((x) => x.id === id);
  if (!s) return (
    <div className="gutter pt-8"><button onClick={onClose} className="h-12 rounded-full bg-card2 px-5 font-semibold">Volver</button><p className="mt-4 text-muted">Este entrenamiento ya no existe.</p></div>
  );
  if (s.type !== 'gym') return <CardioDetail s={s} onClose={onClose} />;
  if (editing) return <SessionEditor session={s} mode="edit" onClose={() => setEditing(false)} />;

  const d = new Date(s.startedAt);
  return (
    <div className="gutter pb-40 pt-5">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="grid h-12 w-12 place-items-center rounded-full bg-pill text-pill-fg" aria-label="Volver"><Icon name="back" /></button>
        <button onClick={() => setEditing(true)} className="ml-auto flex h-12 items-center gap-2 rounded-full bg-card2 px-5 font-semibold"><Icon name="edit" size={18} /> Editar</button>
        <button onClick={() => setConfirm(true)} className="grid h-12 w-12 place-items-center rounded-full bg-card2 text-danger" aria-label="Borrar entrenamiento"><Icon name="trash" size={20} /></button>
      </div>
      <p className="mt-6 text-sm font-semibold text-muted">{cap(d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · {d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
      <h1 className="mt-1 font-display text-[30px] font-semibold leading-tight">{s.title || 'Entrenamiento'}</h1>

      <div className="mt-4 flex items-center rounded-full bg-paper p-1.5 text-paper-ink">
        {[['Duración', `${sessionDurationMin(s)} min`], ['Series', String(sessionDoneSets(s))], ['Ejercicios', String(s.exercises.length)]].map(([l, v]) => (
          <div key={l} className="flex-1 rounded-full px-3 py-2 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-55">{l}</p>
            <p className="font-display text-[16px] font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {s.notes && <p className="mt-4 whitespace-pre-wrap rounded-[24px] bg-card p-4 text-[15px] ring-1 ring-line">{s.notes}</p>}

      <div className="mt-5 space-y-3">
        {s.exercises.map((e, i) => {
          const ex = exById.get(e.exerciseId);
          const best = Math.max(0, ...e.sets.filter((x) => x.done && x.kind === 'work').map((x) => e1rm(x.weight ?? 0, x.reps ?? 0)));
          let n = 0;
          return (
            <section key={e.id} className={`rounded-[30px] p-5 text-[#131313] ${TONES[i % 3]}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-[18px] font-semibold leading-tight">{ex?.name ?? 'Ejercicio eliminado'}</h2>
                  {ex && <p className="text-[13px] opacity-65">{muscleName(ex.primary)}{ex.secondary.length ? ` + ${ex.secondary.map(muscleName).join(', ')}` : ''}</p>}
                </div>
                {best > 0 && <span className="shrink-0 rounded-full bg-[#131313] px-3 py-1 text-[12px] font-semibold text-white" title="1RM estimado con la fórmula de Epley">1RM ≈ {formatKg(Math.round(best * 2) / 2)} kg</span>}
              </div>
              <table className="mt-3 w-full text-[15px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider opacity-55"><th className="py-1 font-bold">Serie</th><th className="font-bold">kg</th><th className="font-bold">Reps</th><th className="font-bold">{settings.effortScale}</th></tr></thead>
                <tbody>
                  {e.sets.map((x) => {
                    if (x.kind === 'work') n++;
                    return (
                      <tr key={x.id} className={`border-t border-black/10 ${x.done ? '' : 'opacity-40'}`}>
                        <td className="py-1.5 font-semibold">{x.kind === 'warmup' ? 'C' : n}</td>
                        <td>{x.weight == null ? '—' : formatKg(x.weight)}</td>
                        <td>{x.reps ?? '—'}</td>
                        <td>{x.effort ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {e.notes && <p className="mt-2 text-[14px] opacity-75">{e.notes}</p>}
            </section>
          );
        })}
      </div>

      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} danger title="¿Borrar este entrenamiento?"
        body="Se eliminarán todas sus series del historial y de las estadísticas. No se puede deshacer; si quieres conservarlo, exporta antes una copia desde Perfil."
        confirmLabel="Borrar" onConfirm={() => { void deleteSession(s.id); onClose(); }} />
    </div>
  );
}

function CardioDetail({ s, onClose }: { s: import('../../domain/types').Session; onClose: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const c = s.cardio ?? {};
  const d = new Date(s.startedAt);
  const stats: [string, string][] = [
    ['Distancia', c.distanceKm ? `${String(Math.round(c.distanceKm * 100) / 100).replace('.', ',')} km` : '—'],
    ['Duración', fmtDuration(c.durationSec)],
    ['Ritmo medio', c.paceSecPerKm ? `${fmtPace(c.paceSecPerKm)} /km` : '—'],
    ['Desnivel', c.elevationM != null ? `${c.elevationM} m` : '—'],
    ['FC media', c.avgHr != null ? `${c.avgHr} ppm` : '—'],
    ['Calorías', c.calories != null ? `${c.calories} kcal` : '—'],
  ];
  return (
    <div className="gutter pb-40 pt-5">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="grid h-12 w-12 place-items-center rounded-full bg-pill text-pill-fg" aria-label="Volver"><Icon name="back" /></button>
        <button onClick={() => setEditing(true)} className="ml-auto flex h-12 items-center gap-2 rounded-full bg-card2 px-5 font-semibold"><Icon name="edit" size={18} /> Editar</button>
        <button onClick={() => setConfirm(true)} className="grid h-12 w-12 place-items-center rounded-full bg-card2 text-danger" aria-label="Borrar actividad"><Icon name="trash" size={20} /></button>
      </div>
      <p className="mt-6 text-sm font-semibold text-muted">{cap(d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · {d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
      <h1 className="mt-1 font-display text-[30px] font-semibold leading-tight">{s.title || ACTIVITY[s.type as keyof typeof ACTIVITY]}</h1>
      <p className="mt-1 text-muted">{cardioSummary(s)}</p>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-[32px] bg-lav p-3 text-lav-ink">
        {stats.map(([l, v]) => (
          <div key={l} className="rounded-[24px] field px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-60">{l}</p>
            <p className="font-display text-[20px] font-semibold">{v}</p>
          </div>
        ))}
      </div>
      {c.feeling && <p className="mt-4 inline-block rounded-full bg-lime px-4 py-2 font-semibold text-lime-ink">Sensaciones: {FEELINGS[c.feeling - 1]}</p>}
      {s.notes && <p className="mt-4 whitespace-pre-wrap rounded-[24px] bg-card p-4 text-[15px] ring-1 ring-line">{s.notes}</p>}
      {editing && <CardioForm session={s} onClose={() => setEditing(false)} />}
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} danger title="¿Borrar esta actividad?" body="Se eliminará del historial. No se puede deshacer."
        confirmLabel="Borrar" onConfirm={() => { void deleteSession(s.id); onClose(); }} />
    </div>
  );
}
