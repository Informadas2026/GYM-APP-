import { useMemo } from 'react';
import { useAppData } from '../../state';
import { cap, sessionDoneSets, sessionDurationMin } from '../../domain/calc';
import { Icon } from '../../ui/Icon';
import { PastWorkoutButton } from '../workout/PastWorkout';
import { ACTIVITY, CardioButton, cardioSummary } from '../cardio/CardioForm';

export function History({ openSession, onPast }: { openSession: (id: string) => void; onPast: (id: string) => void }) {
  const { sessions } = useAppData();
  const groups = useMemo(() => {
    const m = new Map<string, typeof sessions>();
    for (const s of sessions.filter((x) => x.status === 'done')) {
      const d = new Date(s.startedAt);
      const k = cap(d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).replace(' de ', ' '));
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [sessions]);

  return (
    <div className="gutter pb-40 pt-8">
      <h1 className="font-display text-[38px] font-semibold leading-none">Historial</h1>
      <p className="mt-2 text-muted">Toca un entrenamiento para verlo completo, editarlo o borrarlo. El calendario interactivo llega en la fase 3.</p>
      <PastWorkoutButton onCreated={onPast} className="mt-4" />
      <CardioButton onSaved={(id) => openSession(id)} className="mt-2" />
      {groups.length === 0 && (
        <p className="mt-8 rounded-[28px] bg-card p-6 text-muted ring-1 ring-line">Todavía no hay entrenamientos guardados.</p>
      )}
      {groups.map(([month, list]) => (
        <section key={month} className="mt-8">
          <h2 className="mb-3 flex items-baseline justify-between font-display text-[20px] font-semibold">
            {month}<span className="font-sans text-sm font-semibold normal-case text-muted">{list.length} {list.length === 1 ? 'sesión' : 'sesiones'}</span>
          </h2>
          <ul className="space-y-2">
            {list.map((s, i) => (
              <li key={s.id}>
                <button onClick={() => openSession(s.id)}
                  className={`flex w-full items-center gap-4 rounded-[30px] p-4 text-left ${i % 2 === 0 ? 'bg-card ring-1 ring-line' : 'bg-card2'}`}>
                  <span className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-full ${s.type === 'gym' ? 'bg-lime text-lime-ink' : 'bg-lav text-lav-ink'}`}>
                    <span className="font-display text-[20px] font-semibold leading-none">{new Date(s.startedAt).getDate()}</span>
                    <span className="text-[11px] font-bold uppercase">{new Date(s.startedAt).toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{s.title || (s.type === 'gym' ? 'Entrenamiento' : ACTIVITY[s.type])}</span>
                    <span className="block text-[13px] text-muted">{s.type === 'gym' ? `${sessionDurationMin(s)} min · ${sessionDoneSets(s)} series` : `${ACTIVITY[s.type]} · ${cardioSummary(s)}`}</span>
                  </span>
                  <Icon name="next" size={18} className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
