import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Gráficos ligeros en SVG, sin librerías. Una serie por gráfico, color --chart,
 * rejilla discreta, tooltip al tocar o pasar el dedo.
 */

const H = 168; // alto del área de dibujo (px de viewBox)
const PAD = { l: 34, r: 10, t: 12, b: 24 };

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

/** Escala con marcas redondas: devuelve [mín, máx, marcas]. `integer` evita marcas decimales. */
function scale(lo: number, hi: number, integer = false): [number, number, number[]] {
  if (hi <= lo) hi = lo + 1;
  let step = niceStep((hi - lo) / 4);
  if (integer) step = Math.max(1, Math.round(step));
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = a; v <= b + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
  return [a, b, out];
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(340);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function Tip({ x, w, children }: { x: number; w: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 70), w - 70);
  return (
    <div className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+4px)] whitespace-nowrap rounded-2xl bg-pill px-3 py-1.5 text-[12px] font-semibold leading-tight text-pill-fg shadow-lg"
      style={{ left }}>
      {children}
    </div>
  );
}

const fmtTick = (v: number) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1).replace('.', ',') + 'k' : String(Math.round(v * 10) / 10).replace('.', ','));

/* ---------- Barras verticales ---------- */

export function Bars({ values, labels, tip, goal, goalLabel, format = fmtTick, ariaLabel, integer = false }: {
  integer?: boolean;
  values: number[];
  labels: string[];
  tip: (i: number) => ReactNode;
  goal?: number;
  goalLabel?: string;
  format?: (v: number) => string;
  ariaLabel: string;
}) {
  const [ref, w] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const [, max, marks] = scale(0, Math.max(...values, goal ?? 0, 1), integer);
  const iw = w - PAD.l - PAD.r;
  const step = iw / Math.max(values.length, 1);
  const bw = Math.max(3, Math.min(28, step - 2));
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / max);
  const every = Math.ceil(values.length / 6);
  const ax = active != null ? PAD.l + step * active + step / 2 : 0;

  return (
    <div ref={ref} className="relative mt-3 select-none" onPointerLeave={() => setActive(null)}>
      {active != null && <Tip x={ax} w={w}>{tip(active)}</Tip>}
      <svg width={w} height={H} role="img" aria-label={ariaLabel} className="block touch-pan-y">
        {marks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{format(t)}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const x = PAD.l + step * i + (step - bw) / 2;
          const h = Math.max(v > 0 ? 3 : 0, y(0) - y(v));
          return (
            <path key={i} d={roundedTop(x, y(0) - h, bw, h, Math.min(4, bw / 2))}
              fill="var(--chart)" opacity={active == null || active === i ? 1 : 0.45} />
          );
        })}
        {goal != null && (
          <g>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(goal)} y2={y(goal)} stroke="var(--fg)" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.7} />
            {goalLabel && <text x={w - PAD.r} y={y(goal) - 5} textAnchor="end" fontSize={11} fontWeight={700} fill="var(--fg)">{goalLabel}</text>}
          </g>
        )}
        {labels.map((l, i) => (i % every === 0 || i === labels.length - 1) && (i === labels.length - 1 || labels.length - 1 - i >= every / 2) ? (
          <text key={i} x={PAD.l + step * i + step / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">{l}</text>
        ) : null)}
        {values.map((_, i) => (
          <rect key={i} x={PAD.l + step * i} y={0} width={step} height={H} fill="transparent"
            onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
        ))}
      </svg>
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return '';
  r = Math.min(r, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/* ---------- Línea en el tiempo ---------- */

export interface LinePoint { t: number; v: number; mark?: boolean }

export function Line({ points, tip, invert = false, format = fmtTick, ariaLabel, from, to }: {
  points: LinePoint[];
  tip: (i: number) => ReactNode;
  /** true: valores bajos arriba (ritmo: menos segundos = más rápido). */
  invert?: boolean;
  format?: (v: number) => string;
  ariaLabel: string;
  from: number;
  to: number;
}) {
  const [ref, w] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const gid = useId();
  const vs = points.map((p) => p.v);
  let lo0 = Math.min(...vs), hi0 = Math.max(...vs);
  if (lo0 === hi0) { lo0 -= 1; hi0 += 1; }
  const [lo, hi, marks] = scale(Math.max(0, lo0 - (hi0 - lo0) * 0.1), hi0 + (hi0 - lo0) * 0.1);
  const iw = w - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const span = Math.max(1, to - from);
  const x = (t: number) => PAD.l + iw * ((t - from) / span);
  const y = (v: number) => PAD.t + ih * (invert ? (v - lo) / (hi - lo) : 1 - (v - lo) / (hi - lo));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const area = points.length > 1 ? `${d} L${x(points[points.length - 1].t)},${PAD.t + ih} L${x(points[0].t)},${PAD.t + ih} Z` : '';

  const nearest = (clientX: number, el: SVGSVGElement) => {
    const px = clientX - el.getBoundingClientRect().left;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const dd = Math.abs(x(p.t) - px); if (dd < bd) { bd = dd; best = i; } });
    setActive(best);
  };

  const months = monthTicks(from, to);
  return (
    <div ref={ref} className="relative mt-3 select-none" onPointerLeave={() => setActive(null)}>
      {active != null && <Tip x={x(points[active].t)} w={w}>{tip(active)}</Tip>}
      <svg width={w} height={H} role="img" aria-label={ariaLabel} className="block touch-pan-y"
        onPointerMove={(e) => nearest(e.clientX, e.currentTarget)} onPointerDown={(e) => nearest(e.clientX, e.currentTarget)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--chart)" stopOpacity={0.28} />
            <stop offset="1" stopColor="var(--chart)" stopOpacity={0} />
          </linearGradient>
        </defs>
        {marks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)">{format(t)}</text>
          </g>
        ))}
        {months.map((m) => (
          <text key={m.t} x={x(m.t)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">{m.label}</text>
        ))}
        {area && !invert && <path d={area} fill={`url(#${gid})`} />}
        <path d={d} fill="none" stroke="var(--chart)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {active != null && <line x1={x(points[active].t)} x2={x(points[active].t)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 3" />}
        {points.map((p, i) => (
          p.mark ? (
            <circle key={i} cx={x(p.t)} cy={y(p.v)} r={active === i ? 7 : 5.5} fill="var(--chart)" stroke="var(--card)" strokeWidth={2} />
          ) : (
            <circle key={i} cx={x(p.t)} cy={y(p.v)} r={active === i ? 6 : 3.5} fill="var(--card)" stroke="var(--chart)" strokeWidth={2} />
          )
        ))}
      </svg>
    </div>
  );
}

function monthTicks(from: number, to: number): { t: number; label: string }[] {
  const out: { t: number; label: string }[] = [];
  const d = new Date(from);
  d.setDate(1); d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() + 1);
  const months = (to - from) / (30 * 86_400_000);
  const stepM = months > 14 ? 3 : months > 7 ? 2 : 1;
  if (months < 1.5) {
    // periodo corto: marcas semanales
    for (let t = from; t <= to; t += 7 * 86_400_000) out.push({ t, label: new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '') });
    return out.filter((_, i) => i % 2 === 0);
  }
  for (; d.getTime() < to; d.setMonth(d.getMonth() + stepM)) {
    out.push({ t: d.getTime(), label: d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') });
  }
  return out;
}

/* ---------- Mapa de calor de días ---------- */

export function Heatmap({ weeks, level, tip, ariaLabel }: {
  weeks: number[];
  /** 0 = sin actividad, 1..3 intensidad. */
  level: (day: number) => number;
  tip: (day: number) => string;
  ariaLabel: string;
}) {
  const [ref, w] = useWidth();
  const [active, setActive] = useState<number | null>(null);
  const left = 18;
  const gap = 3;
  const cell = Math.min(22, Math.floor((w - left - gap * weeks.length) / Math.max(weeks.length, 1)));
  const height = 7 * (cell + gap) + 16;
  const today = Date.now();
  const OP = [0, 0.4, 0.7, 1];
  const pos = active != null ? { x: left + Math.floor(weeks.findIndex((wk) => active >= wk && active < wk + 7 * 86_400_000 + 3_600_000)) * (cell + gap) + cell / 2 } : null;

  return (
    <div ref={ref} className="relative mt-3 select-none" onPointerLeave={() => setActive(null)}>
      {active != null && pos && <Tip x={pos.x} w={w}>{tip(active)}</Tip>}
      <svg width={w} height={height} role="img" aria-label={ariaLabel} className="block touch-pan-y">
        {['L', '', 'X', '', 'V', '', 'D'].map((l, r) => l && (
          <text key={r} x={0} y={r * (cell + gap) + cell / 2 + 4} fontSize={10} fill="var(--muted)">{l}</text>
        ))}
        {weeks.map((wk, c) => Array.from({ length: 7 }, (_, r) => {
          const d = new Date(wk); d.setDate(d.getDate() + r); d.setHours(12);
          const t = d.getTime();
          if (t > today + 86_400_000) return null;
          const lv = level(t);
          return (
            <rect key={`${c}-${r}`} x={left + c * (cell + gap)} y={r * (cell + gap)} width={cell} height={cell} rx={Math.min(6, cell / 3)}
              fill={lv ? 'var(--chart)' : 'var(--card2)'} fillOpacity={lv ? OP[lv] : 1}
              stroke={active === t ? 'var(--fg)' : 'none'} strokeWidth={1.5}
              onPointerEnter={() => setActive(t)} onPointerDown={() => setActive(t)} />
          );
        }))}
        {weeks.map((wk, c) => {
          const d = new Date(wk);
          const first = c === 0 || new Date(weeks[c - 1]).getMonth() !== d.getMonth();
          return first && c < weeks.length - 1 ? (
            <text key={wk} x={left + c * (cell + gap)} y={height - 3} fontSize={10} fill="var(--muted)">{d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}</text>
          ) : null;
        })}
      </svg>
    </div>
  );
}

/* ---------- Barras horizontales con banda de referencia ---------- */

export function RangeBars({ rows, band, max, unit }: {
  rows: { label: string; value: number }[];
  band: [number, number];
  max: number;
  unit: string;
}) {
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <ul className="mt-4 space-y-2.5">
      {rows.map((r) => {
        const state = r.value < band[0] ? 'bajo' : r.value > band[1] ? 'alto' : 'ok';
        return (
          <li key={r.label} className="grid grid-cols-[96px_1fr_44px] items-center gap-2">
            <span className="truncate text-[13px] font-semibold">{r.label}</span>
            <span className="relative h-5 rounded-full bg-card2">
              <span className="absolute inset-y-0 rounded-full border border-dashed border-[var(--muted)] opacity-60" style={{ left: pct(band[0]), width: `calc(${pct(band[1])} - ${pct(band[0])})` }} />
              <span className="absolute inset-y-[3px] left-[3px] rounded-full bg-[var(--chart)]" style={{ width: `max(0px, calc(${pct(r.value)} - 6px))`, opacity: state === 'bajo' ? 0.55 : 1 }} />
            </span>
            <span className="text-right text-[13px] font-semibold tabular-nums">{String(Math.round(r.value * 10) / 10).replace('.', ',')}<span className="sr-only"> {unit}</span></span>
          </li>
        );
      })}
    </ul>
  );
}
