import type { ProjectPackage } from '../../types/warta';

interface Props {
  projects: ProjectPackage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  gpsDenied?: boolean;
  className?: string;
}

/** Peta vektor DKI Jakarta (disederhanakan) + inset Kepulauan Seribu + penanda luar DKI. */
export default function JakartaSvgMap({ projects, selectedId, onSelect, gpsDenied, className = '' }: Props) {
  return (
    <svg viewBox="0 0 1000 820" className={`h-full w-full ${className}`} role="img" aria-label="Peta proyek DKI Jakarta">
      <defs>
        <pattern id="sea" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M0 12 Q6 8 12 12 T24 12" fill="none" stroke="#bfdbfe" strokeWidth="1" />
        </pattern>
        <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Laut */}
      <rect width="1000" height="820" fill="#e0f2fe" />
      <rect width="1000" height="260" fill="url(#sea)" />

      {/* Daratan sekitar (Jawa Barat / Banten) */}
      <path d="M0 250 L1000 230 L1000 820 L0 820 Z" fill="#f1f5f9" />

      {/* Batas DKI Jakarta */}
      <path
        d="M60 262 L210 250 L330 270 L460 236 L600 222 L740 262 L880 272 L960 300 L950 420 L910 520 L860 600 L760 660 L640 760 L520 790 L420 770 L380 680 L300 600 L220 560 L120 520 L70 420 Z"
        fill="#ffffff"
        stroke="#1f3b57"
        strokeWidth="3"
      />
      {/* Batas kota administrasi (garis tipis) */}
      <g stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="6 6" fill="none">
        <path d="M70 420 L380 400 L640 390 L950 420" />
        <path d="M380 400 L380 250" />
        <path d="M640 390 L660 230" />
        <path d="M380 400 L420 560 L660 560 L640 390" />
        <path d="M420 560 L420 770" />
        <path d="M660 560 L860 600" />
      </g>
      <g fill="#64748b" fontSize="18" fontWeight="600" fontFamily="Inter, sans-serif">
        <text x="200" y="350">Jakarta Barat</text>
        <text x="460" y="310">Jakarta Utara</text>
        <text x="460" y="480">Jakarta Pusat</text>
        <text x="740" y="480">Jakarta Timur</text>
        <text x="470" y="650">Jakarta Selatan</text>
      </g>

      {/* Inset Kepulauan Seribu */}
      <g>
        <rect x="24" y="24" width="270" height="190" rx="12" fill="#f0f9ff" stroke="#0369a1" strokeWidth="2" />
        <text x="40" y="52" fontSize="15" fontWeight="700" fill="#0c4a6e" fontFamily="Inter, sans-serif">Inset: Kepulauan Seribu</text>
        <ellipse cx="150" cy="150" rx="30" ry="12" fill="#ffffff" stroke="#1f3b57" strokeWidth="2" />
        <ellipse cx="220" cy="110" rx="16" ry="7" fill="#ffffff" stroke="#94a3b8" />
        <ellipse cx="80" cy="180" rx="14" ry="6" fill="#ffffff" stroke="#94a3b8" />
        <text x="110" y="196" fontSize="13" fill="#334155" fontFamily="Inter, sans-serif">P. Pramuka</text>
      </g>

      {/* Penanda Luar DKI (Bekasi) */}
      <g>
        <rect x="810" y="650" width="175" height="34" rx="8" fill="#fef3c7" stroke="#b45309" />
        <text x="822" y="673" fontSize="14" fontWeight="700" fill="#78350f" fontFamily="Inter, sans-serif">Bekasi (Luar DKI)</text>
      </g>

      {/* Monas (pusat fallback GPS) */}
      <g transform="translate(520 450)">
        <circle r={gpsDenied ? 16 : 6} fill={gpsDenied ? '#1d4ed8' : '#94a3b8'} opacity={gpsDenied ? 0.25 : 1}>
          {gpsDenied && <animate attributeName="r" values="10;24;10" dur="2s" repeatCount="indefinite" />}
        </circle>
        <circle r="5" fill={gpsDenied ? '#1d4ed8' : '#94a3b8'} />
        <text x="10" y="-8" fontSize="12" fill="#475569" fontFamily="Inter, sans-serif">Monas</text>
      </g>

      {/* Proyek */}
      {projects.map((p) => {
        const { svgX: x, svgY: y } = p.mapCoordinates;
        const sel = p.id === selectedId;
        const precise = p.precisionLevel === 'alamat/ruas' || p.precisionLevel === 'titik' || (!p.isRoughArea && p.isCanonicalClaimed);
        return (
          <g
            key={p.id}
            id={`map-${p.id}`}
            className="cursor-pointer"
            onClick={() => onSelect(p.id)}
            role="button"
            tabIndex={0}
            aria-label={p.title}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(p.id)}
          >
            {precise ? (
              <g transform={`translate(${x} ${y})`} filter="url(#pinShadow)">
                <path
                  d="M0 0 C-14 -18 -18 -26 -18 -34 A18 18 0 1 1 18 -34 C18 -26 14 -18 0 0 Z"
                  fill={sel ? '#0369a1' : '#1f3b57'}
                  stroke="#fff"
                  strokeWidth="2"
                  transform={sel ? 'scale(1.25)' : undefined}
                />
                <circle cy={sel ? -42 : -34} r="6" fill="#fff" />
              </g>
            ) : (
              <g>
                <circle
                  cx={x}
                  cy={y}
                  r={sel ? 58 : 46}
                  fill={sel ? 'rgba(3,105,161,0.18)' : 'rgba(31,59,87,0.08)'}
                  stroke={sel ? '#0369a1' : '#1f3b57'}
                  strokeWidth={sel ? 3 : 2}
                  strokeDasharray="8 6"
                  className="transition-all"
                />
                <circle cx={x} cy={y} r="7" fill={sel ? '#0369a1' : '#1f3b57'} stroke="#fff" strokeWidth="2" />
              </g>
            )}
            {sel && (
              <text x={x} y={y + (precise ? 26 : 76)} textAnchor="middle" fontSize="15" fontWeight="700" fill="#0c4a6e" fontFamily="Inter, sans-serif" paintOrder="stroke" stroke="#fff" strokeWidth="4">
                {p.title}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
