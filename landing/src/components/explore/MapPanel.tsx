import { Layers, MapPinOff } from 'lucide-react';
import type { ProjectPackage } from '../../types/warta';
import JakartaSvgMap from '../map/JakartaSvgMap';
import MapFloatingSheet from '../map/MapFloatingSheet';

interface Props {
  projects: ProjectPackage[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onOpen: (id: string) => void;
  compact: boolean;
  showDistance: boolean;
  gpsDenied: boolean;
  tileError: boolean;
  loading: boolean;
  onRetry: () => void;
}

export default function MapPanel({
  projects,
  selectedId,
  onSelect,
  onOpen,
  compact,
  showDistance,
  gpsDenied,
  tileError,
  loading,
  onRetry,
}: Props) {
  const selected = projects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="relative h-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
      {tileError ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
          <MapPinOff className="size-10 text-bad-border" aria-hidden="true" />
          <h2 className="text-lg font-bold text-slate-900">Peta gagal dimuat</h2>
          <p className="max-w-xs text-base text-slate-600">
            Koneksi ke layanan peta terputus. Anda tetap dapat memilih paket proyek dari daftar di
            samping.
          </p>
          <button
            type="button"
            id="map-retry"
            onClick={onRetry}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Muat ulang peta
          </button>
        </div>
      ) : (
        <>
          <JakartaSvgMap
            projects={projects}
            selectedId={selectedId}
            onSelect={onSelect}
            gpsDenied={gpsDenied}
            className={loading ? 'animate-pulse opacity-60' : ''}
          />
          <div className="absolute top-3 right-3 space-y-1.5 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-xs backdrop-blur-xs">
            <p className="flex items-center gap-1.5 font-semibold text-slate-900">
              <Layers className="size-3.5 text-brand" aria-hidden="true" /> Keterangan pin
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-600">
              <svg width="14" height="14" aria-hidden="true">
                <circle
                  cx="7"
                  cy="7"
                  r="6"
                  fill="none"
                  stroke="#1f3b57"
                  strokeDasharray="3 2"
                  strokeWidth="1.5"
                />
              </svg>
              Area perkiraan (tingkat kota/kelurahan)
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-600">
              <svg width="14" height="14" aria-hidden="true">
                <path d="M7 13 C3 8 2 6 2 5 A5 5 0 1 1 12 5 C12 6 11 8 7 13Z" fill="#1f3b57" />
              </svg>
              Titik lokasi terverifikasi
            </p>
          </div>
          {selected && (
            <MapFloatingSheet
              project={selected}
              compact={compact}
              showDistance={showDistance}
              onOpen={() => onOpen(selected.id)}
              onClose={() => onSelect(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
