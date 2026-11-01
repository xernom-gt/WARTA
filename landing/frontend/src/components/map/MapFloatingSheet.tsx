import { ArrowRight, X } from 'lucide-react';
import type { ProjectPackage } from '../../types/warta';
import StatusBadge from '../common/StatusBadge';

interface Props {
  project: ProjectPackage;
  compact: boolean;
  showDistance: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export default function MapFloatingSheet({ project: p, compact, showDistance, onOpen, onClose }: Props) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 animate-slide-up rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 lg:hidden" />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2"><StatusBadge status={p.status} /></div>
          <h3 className="truncate font-bold text-slate-900">{p.title}</h3>
          <p className="text-xs text-slate-500">
            #{p.spseCode} • {showDistance ? p.distanceText : p.city}
          </p>
          <p className="mt-1 text-base font-extrabold text-brand">{compact ? p.paguCompact : p.paguFull}</p>
        </div>
        <button id="sheet-close" onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-100" aria-label="Tutup ringkasan">
          <X className="size-4" />
        </button>
      </div>
      {p.isRoughArea && p.precisionMicrocopy && <p className="mt-2 text-xs text-slate-600">{p.precisionMicrocopy}</p>}
      <button id="sheet-open-detail" onClick={onOpen} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
        Buka Detail <ArrowRight className="size-4" />
      </button>
    </div>
  );
}
