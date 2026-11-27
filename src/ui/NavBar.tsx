import { Icon } from './Icon';

export type Tab = 'inicio' | 'entreno' | 'evolucion' | 'historial' | 'perfil';
const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'inicio', icon: 'home', label: 'Inicio' },
  { id: 'entreno', icon: 'dumbbell', label: 'Entrenamiento' },
  { id: 'evolucion', icon: 'chart', label: 'Evolución' },
  { id: 'historial', icon: 'calendar', label: 'Historial' },
  { id: 'perfil', icon: 'user', label: 'Perfil' },
];

/** Barra flotante en píldora con botones redondos; la pestaña activa se rellena de lavanda. */
export function NavBar({ tab, onChange, live }: { tab: Tab; onChange: (t: Tab) => void; live: boolean }) {
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center gutter"
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }} aria-label="Secciones">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-card p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] ring-1 ring-line">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button key={t.id} onClick={() => onChange(t.id)} aria-label={t.label} aria-current={active ? 'page' : undefined}
              className={`relative grid h-[52px] w-[52px] place-items-center rounded-full transition-colors duration-200 ${active ? 'bg-hi text-hi-ink' : 'bg-pill text-pill-fg'}`}>
              <Icon name={t.icon} size={21} />
              {t.id === 'entreno' && live && !active && (
                <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-lime ring-2 ring-pill" aria-label="Entrenamiento en curso" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
