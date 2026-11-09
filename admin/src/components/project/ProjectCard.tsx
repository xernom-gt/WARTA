import { MapPin } from 'lucide-react';
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
      className={`group flex cursor-pointer flex-col justify-between rounded-2xl border bg-white p-6 shadow-xs transition hover:border-slate-300 hover:shadow-md ${
        selected ? 'border-action-border ring-2 ring-action-border/40' : 'border-slate-200'
      }`}
    >
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <StatusBadge status={p.status} />
          <span className="text-xs font-medium text-slate-600">{p.category}</span>
        </div>

        <h3 className="text-lg leading-snug font-bold text-slate-900 group-hover:text-brand">
          {p.title}
        </h3>
      </div>

      <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs font-medium text-slate-600">Pagu Anggaran</p>
          <p className="text-xl font-extrabold text-brand tabular-nums">
            {compact ? p.paguCompact : p.paguFull}
          </p>
        </div>

        <p className="flex items-center gap-1.5 text-sm text-slate-600">
          <MapPin className="size-4 shrink-0 text-brand" />
          <span className="truncate">{showDistance ? p.distanceText : p.locationDesc}</span>
        </p>
      </div>
    </article>
  );
}
