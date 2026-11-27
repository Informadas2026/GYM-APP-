import { useEffect, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Sheet({ open, onClose, title, children, full = false }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; full?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/55" aria-label="Cerrar" onClick={onClose} />
      <div className={`anim-sheet relative flex w-full max-w-[560px] flex-col rounded-t-[32px] bg-bg text-fg ${full ? 'h-[92%]' : 'max-h-[88%]'}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="gutter flex items-center justify-between gap-3 pb-2 pt-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full bg-card2" aria-label="Cerrar">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="gutter min-h-0 flex-1 overflow-y-auto pb-6">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmSheet({ open, title, body, confirmLabel, danger, onConfirm, onClose }: {
  open: boolean; title: string; body: string; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-5 text-[15px] text-muted">{body}</p>
      <div className="flex gap-3">
        <button className="h-14 flex-1 rounded-full bg-card2 font-semibold" onClick={onClose}>Cancelar</button>
        <button className={`h-14 flex-1 rounded-full font-semibold ${danger ? 'bg-danger text-white' : 'bg-lime text-lime-ink'}`}
          onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
      </div>
    </Sheet>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`h-11 rounded-full px-4 text-sm font-semibold transition-colors ${o.value === value ? 'bg-pill text-pill-fg' : 'bg-card2 text-fg'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
