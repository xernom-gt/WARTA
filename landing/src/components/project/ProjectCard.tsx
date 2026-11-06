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
      className={`group flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-4 transition hover:border-slate-300 hover:shadow-md ${
        selected ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200'
      }`}
    >
      <div>
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={p.status} />
          {p.isRetender && (
            <span className="inline-flex items-center gap-1 rounded-md border border-wait-border/40 bg-wait-bg px-2 py-0.5 text-xs font-medium text-wait-text">
              <RefreshCw className="size-3" /> Tender ulang
            </span>
          )}
          <span className="text-xs text-slate-500">{p.category}</span>
        </div>

        <h3 className="text-base font-bold leading-snug text-slate-900 group-hover:text-brand">
          {p.title}
        </h3>
        <p className="mt-0.5 font-mono text-xs text-slate-500">Kode SPSE #{p.spseCode}</p>

        <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-slate-100 pt-3">
          <div>
            <p className="text-xs text-slate-500">Nilai Pagu</p>
            <p className="text-lg font-extrabold tabular-nums text-slate-900">
              {compact ? p.paguCompact : p.paguFull}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {p.years.map((y) => (
              <span
                key={y}
                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600"
              >
                {y}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-3">
        <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{showDistance ? p.distanceText : p.city}</span>
          </span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {p.precisionBadge}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <MessageSquareText className="size-3.5 text-brand" />
            Lihat Detail & Aduan ({p.reportsCount})
          </button>
          {onReport && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReport();
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
            >
              <Camera className="size-3.5" /> Lapor
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
