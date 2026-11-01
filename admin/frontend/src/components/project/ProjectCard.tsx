import { MapPin, MessageSquareText, RefreshCw } from 'lucide-react';
import type { ProjectPackage } from '../../types/warta';
import StatusBadge from '../common/StatusBadge';

interface Props {
  project: ProjectPackage;
  compact: boolean;
  showDistance: boolean;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}

export default function ProjectCard({ project: p, compact, showDistance, selected, onSelect, onOpen }: Props) {
  return (
    <article
      id={`card-${p.id}`}
      onMouseEnter={onSelect}
      onClick={onOpen}
      className={`group cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${
        selected ? 'border-action-border ring-2 ring-action-border/40' : 'border-slate-200'
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <StatusBadge status={p.status} />
        {p.isRetender && (
          <span className="inline-flex items-center gap-1 rounded-full bg-wait-bg px-2 py-0.5 text-xs font-semibold text-wait-text">
            <RefreshCw className="size-3" />Tender Ulang
          </span>
        )}
        <span className="text-xs text-slate-500">{p.category}</span>
      </div>
      <h3 className="font-bold leading-snug text-slate-900 group-hover:text-brand">{p.title}</h3>
      <p className="mb-3 font-mono text-xs text-slate-500">#{p.spseCode}</p>

      <div className="mb-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Pagu</p>
          <p className="text-lg font-extrabold text-brand">{compact ? p.paguCompact : p.paguFull}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          {p.years.map((y) => (
            <span key={y} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{y}</span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
        <span className="flex min-w-0 items-center gap-1">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{showDistance ? p.distanceText : p.city}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1"><MessageSquareText className="size-3.5" />{p.reportsCount} laporan</span>
      </div>
      <p className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{p.precisionBadge}</p>
    </article>
  );
}
