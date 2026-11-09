import { Camera, MapPin, MessageSquareText, RefreshCw } from 'lucide-react';
import type { ProjectPackage } from '../../types/warta';
import StatusBadge from '../common/StatusBadge';

interface Props {
  project: ProjectPackage;
  compact: boolean;
  showDistance: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onReport?: () => void;
}

export default function ProjectCard({
  project: p,
  compact,
  showDistance,
  selected,
  onSelect,
  onOpen,
  onReport,
}: Props) {
  return (
    <article
      id={`card-${p.id}`}
      onMouseEnter={onSelect}
      onClick={onOpen}
      className={`group flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-6 transition hover:border-slate-300 hover:shadow-md ${
        selected ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200'
      }`}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge status={p.status} />
          {p.isRetender && (
            <span className="inline-flex items-center gap-1 rounded-md bg-wait-bg px-2 py-0.5 text-xs font-semibold text-wait-text">
              <RefreshCw className="size-3" aria-hidden="true" /> Tender ulang
            </span>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-600">{p.category}</p>
          <h3 className="mt-1 text-lg font-bold leading-snug text-slate-900 group-hover:text-brand">
            {p.title}
          </h3>
        </div>

        <div className="pt-1">
          <p className="text-xs font-medium text-slate-600">Nilai Pagu Anggaran</p>
          <p className="text-xl font-extrabold tabular-nums text-slate-900">
            {compact ? p.paguCompact : p.paguFull}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
        <p className="flex items-center gap-1.5 text-sm text-slate-600">
          <MapPin className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
          <span className="truncate">{showDistance ? p.distanceText : p.city}</span>
        </p>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <MessageSquareText className="size-4 text-brand" aria-hidden="true" />
            Detail Proyek
          </button>
          {onReport && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReport();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <Camera className="size-4" aria-hidden="true" /> Lapor
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
