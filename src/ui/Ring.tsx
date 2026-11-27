/** Anillo de progreso: series completadas sobre el total. */
export function Ring({ done, total, size = 56, label }: { done: number; total: number; size?: number; label?: string }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-label={label ?? `${done} de ${total} series`} role="img">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(255,255,255,0.55)" stroke="rgba(19,19,19,0.1)" strokeWidth="6" />
        {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#131313" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} style={{ transition: 'stroke-dasharray .4s ease' }} />}
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-[15px] font-semibold text-[#131313]">{done}</span>
    </div>
  );
}
