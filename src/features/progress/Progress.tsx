import { useMemo } from 'react';
import { useAppData } from '../../state';
import { e1rm, formatKg } from '../../domain/calc';
import { muscleName } from '../../domain/muscles';

/** Fase 1: mejores marcas reales por ejercicio. Los gráficos y el mapa muscular llegan en la fase 4. */
export function Progress() {
  const { sessions, exById } = useAppData();
  const rows = useMemo(() => {
    const best = new Map<string, { weight: number; reps: number; e: number; date: number; times: number }>();
    for (const s of sessions) {
      if (s.status !== 'done') continue;
      for (const ex of s.exercises) {
        const prev = best.get(ex.exerciseId);
        let cur = prev ? { ...prev, times: prev.times + 1 } : { weight: 0, reps: 0, e: 0, date: s.startedAt, times: 1 };
        for (const set of ex.sets) {
          if (!set.done || set.kind !== 'work') continue;
          const est = e1rm(set.weight ?? 0, set.reps ?? 0);
          if (est > cur.e) cur = { ...cur, weight: set.weight ?? 0, reps: set.reps ?? 0, e: est, date: s.startedAt };
        }
        best.set(ex.exerciseId, cur);
      }
    }
    return [...best.entries()].filter(([, b]) => b.e > 0).sort((a, b) => b[1].date - a[1].date);
  }, [sessions]);

  return (
    <div className="gutter pb-40 pt-8">
      <h1 className="font-display text-[38px] font-semibold leading-none">Evolución</h1>
      <p className="mt-2 text-muted">Tus mejores marcas, calculadas con tus series registradas. Los gráficos, comparativas y el mapa muscular llegan en la fase 4.</p>
      {rows.length === 0 ? (
        <p className="mt-8 rounded-[28px] bg-card p-6 text-muted ring-1 ring-line">Cuando guardes tu primer entrenamiento verás aquí tus récords por ejercicio.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {rows.map(([id, b], i) => {
            const ex = exById.get(id);
            return (
              <li key={id} className={`flex items-center gap-4 rounded-[30px] p-4 ${i === 0 ? 'bg-lav text-lav-ink' : 'bg-card ring-1 ring-line'}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{ex?.name ?? 'Ejercicio eliminado'}</p>
                  <p className={`text-[13px] ${i === 0 ? 'opacity-70' : 'text-muted'}`}>
                    {ex ? muscleName(ex.primary) + ' · ' : ''}Mejor serie {formatKg(b.weight)} kg × {b.reps} · {new Date(b.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${i === 0 ? 'opacity-60' : 'text-muted'}`}>1RM est.</p>
                  <p className="font-display text-[20px] font-semibold">{formatKg(Math.round(b.e * 2) / 2)}<span className="text-sm"> kg</span></p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-6 text-[13px] text-muted">1RM estimado = peso × (1 + repeticiones / 30), fórmula de Epley. Solo cuenta series efectivas, no calentamientos.</p>
    </div>
  );
}
