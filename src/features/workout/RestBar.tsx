import { useRest, fmtClock } from '../../state';
import { Icon } from '../../ui/Icon';

/** Temporizador de descanso flotante sobre la barra de navegación. */
export function RestBar() {
  const { rest, remaining, finished, add, stop } = useRest();
  if (!rest) return null;
  const pct = rest.total > 0 ? 1 - remaining / rest.total : 1;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center gutter" style={{ bottom: 'calc(max(12px, env(safe-area-inset-bottom, 0px)) + 76px)' }}>
      <div role="timer" aria-live="polite" className={`anim-rise pointer-events-auto w-full max-w-[528px] overflow-hidden rounded-[32px] ${finished ? 'bg-lime text-lime-ink' : 'bg-paper text-paper-ink'} shadow-[0_12px_40px_rgba(0,0,0,0.35)]`}>
        <div className="h-1.5 bg-black/10"><div className="h-full bg-[#131313] transition-[width] duration-300" style={{ width: `${pct * 100}%` }} /></div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold uppercase tracking-wider opacity-60">{finished ? '¡A por la siguiente!' : 'Descanso'}</p>
            <p className="font-display text-[40px] font-semibold leading-none">{fmtClock(remaining)}</p>
            <p className="mt-1 truncate text-[13px] font-medium opacity-70">{rest.label}</p>
          </div>
          {!finished && (
            <>
              <button onClick={() => add(-15)} className="h-12 w-12 rounded-full bg-black/[0.07] text-sm font-bold" aria-label="Quitar 15 segundos">−15</button>
              <button onClick={() => add(15)} className="h-12 w-12 rounded-full bg-black/[0.07] text-sm font-bold" aria-label="Añadir 15 segundos">+15</button>
            </>
          )}
          <button onClick={stop} className="grid h-12 w-12 place-items-center rounded-full bg-[#131313] text-white" aria-label={finished ? 'Cerrar' : 'Saltar descanso'}>
            <Icon name={finished ? 'x' : 'next'} size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
