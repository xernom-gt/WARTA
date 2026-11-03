import { AlertTriangle, Info } from 'lucide-react';
import type { RiskFlag } from '../../types/warta';

/** Indikator risiko kontrak objektif (bukan tuduhan). */
export default function ContractRiskBadges({ flags }: { flags: RiskFlag[] }) {
  if (flags.length === 0)
    return <p className="text-sm text-slate-500">Tidak ada indikator risiko dari data publik.</p>;
  return (
    <ul className="grid gap-2">
      {flags.map((f) => (
        <li
          key={f.id}
          className={`flex gap-2 rounded-lg border p-3 text-sm ${
            f.level === 'warning' ? 'bg-wait-bg border-wait-border text-wait-text' : 'bg-action-bg border-action-border text-action-text'
          }`}
        >
          {f.level === 'warning' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <Info className="mt-0.5 size-4 shrink-0" />}
          <div>
            <p className="font-semibold">{f.label}</p>
            <p className="opacity-90">{f.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
