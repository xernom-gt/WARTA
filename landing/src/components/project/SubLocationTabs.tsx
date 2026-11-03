import { useState } from 'react';
import { CheckCircle2, CircleDashed, School } from 'lucide-react';
import type { SubLocation } from '../../types/warta';

interface Props {
  locations: SubLocation[];
  microcopy?: string;
}

export default function SubLocationTabs({ locations, microcopy }: Props) {
  const [active, setActive] = useState(locations[0]?.id);
  const current = locations.find((l) => l.id === active);

  return (
    <div>
      {microcopy && <p className="mb-2 text-sm text-slate-600">{microcopy}</p>}
      <div role="tablist" className="flex gap-2 overflow-x-auto pb-2">
        {locations.map((l, i) => (
          <button
            key={l.id}
            id={`subloc-${l.id}`}
            role="tab"
            aria-selected={l.id === active}
            onClick={() => setActive(l.id)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              l.id === active ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white hover:border-brand'
            }`}
          >
            {i + 1}. {l.name}
          </button>
        ))}
      </div>
      {current && (
        <div role="tabpanel" className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <School className="mt-0.5 size-5 text-brand" />
          <div className="flex-1">
            <p className="font-semibold">{current.name}</p>
            <p className="text-slate-600">{current.address}, {current.city}</p>
          </div>
          {current.verified ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-ok-text"><CheckCircle2 className="size-4" />Diverifikasi warga</span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><CircleDashed className="size-4" />Belum diverifikasi</span>
          )}
        </div>
      )}
    </div>
  );
}
