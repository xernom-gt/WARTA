import { SearchX } from 'lucide-react';
import type { ProjectPackage } from '../../types/warta';
import ProjectCard from '../project/ProjectCard';

interface Props {
  projects: ProjectPackage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onReport: (id: string) => void;
  compact: boolean;
  showDistance: boolean;
  loading?: boolean;
  onReset?: () => void;
}

export default function ProjectCatalog({
  projects,
  selectedId,
  onSelect,
  onOpen,
  onReport,
  compact,
  showDistance,
  loading = false,
  onReset,
}: Props) {
  if (loading) {
    return (
      <div className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="shimmer h-5 w-24 rounded" />
            <div className="shimmer h-6 w-3/4 rounded" />
            <div className="shimmer h-4 w-1/3 rounded" />
            <div className="shimmer h-8 w-1/2 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
        <div className="mb-4 grid size-14 place-items-center rounded-full bg-slate-100">
          <SearchX className="size-7 text-slate-500" aria-hidden="true" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Tidak ada paket proyek yang cocok</h2>
        <p className="mt-1.5 mb-6 max-w-sm text-base text-slate-600">
          Coba ubah kata kunci pencarian atau setel ulang filter kota, kategori, maupun tingkat
          presisi lokasi.
        </p>
        {onReset && (
          <button
            type="button"
            id="empty-reset"
            onClick={onReset}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Reset Filter
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {projects.map((p) => (
        <ProjectCard
          key={p.id}
          project={p}
          compact={compact}
          showDistance={showDistance}
          selected={p.id === selectedId}
          onSelect={() => onSelect(p.id)}
          onOpen={() => onOpen(p.id)}
          onReport={() => onReport(p.id)}
        />
      ))}
    </div>
  );
}
