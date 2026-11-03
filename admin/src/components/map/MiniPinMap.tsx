import { useRef, useState, type PointerEvent } from 'react';

interface Props {
  value: { x: number; y: number };
  onChange: (v: { x: number; y: number }) => void;
  /** Lingkaran estimasi kota SPSE (abu-abu putus-putus). */
  estimate?: { x: number; y: number; r: number };
  label?: string;
}

/** Peta mini dengan pin biru yang bisa digeser / diklik. Koordinat 0–100. */
export default function MiniPinMap({ value, onChange, estimate, label = 'Geser pin ke titik pengamatan' }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState(false);

  const move = (e: PointerEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(98, Math.max(4, ((e.clientY - r.top) / r.height) * 100));
    onChange({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };

  return (
    <div>
      <svg
        ref={ref}
        viewBox="0 0 100 60"
        preserveAspectRatio="none"
        className={`h-52 w-full touch-none rounded-xl border border-slate-300 bg-[#eef2f6] ${drag ? 'cursor-grabbing' : 'cursor-crosshair'}`}
        onPointerDown={(e) => { setDrag(true); e.currentTarget.setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={(e) => drag && move(e)}
        onPointerUp={() => setDrag(false)}
      >
        <g stroke="#ffffff" strokeWidth="2.4" fill="none">
          <path d="M0 20 L100 24" /><path d="M0 44 L100 40" /><path d="M30 0 L34 60" /><path d="M70 0 L66 60" />
        </g>
        <g stroke="#cbd5e1" strokeWidth="0.8" fill="none">
          <path d="M0 32 L100 32" /><path d="M50 0 L50 60" />
        </g>
        <rect x="38" y="26" width="10" height="8" fill="#dcfce7" />
        {estimate && (
          <ellipse cx={estimate.x} cy={estimate.y * 0.6} rx={estimate.r} ry={estimate.r * 0.6} fill="rgba(100,116,139,0.12)" stroke="#64748b" strokeWidth="0.6" strokeDasharray="2 1.5" />
        )}
        <g transform={`translate(${value.x} ${value.y * 0.6})`}>
          <ellipse rx="2" ry="0.8" fill="rgba(0,0,0,0.25)" />
          <path d="M0 0 C-2 -3 -3 -4.5 -3 -6 A3 3 0 1 1 3 -6 C3 -4.5 2 -3 0 0Z" fill="#0369a1" stroke="#fff" strokeWidth="0.5" />
        </g>
      </svg>
      <p className="mt-1 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-mono">
          {(-6.1 - value.y / 1000).toFixed(4)}, {(106.8 + value.x / 1000).toFixed(4)}
        </span>
      </p>
    </div>
  );
}
