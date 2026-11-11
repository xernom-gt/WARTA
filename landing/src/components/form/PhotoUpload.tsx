import { ImagePlus, Trash2 } from 'lucide-react';

interface Photo {
  name: string;
  url: string;
}

interface Props {
  photos: Photo[];
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  onAddSample?: () => void;
  maxPhotos?: number;
  showSampleButton?: boolean;
}

export default function PhotoUpload({
  photos,
  onAdd,
  onRemove,
  onAddSample,
  maxPhotos = 4,
  showSampleButton = false,
}: Props) {
  const canAdd = photos.length < maxPhotos;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          {photos.length} / {maxPhotos} foto
        </p>
        {showSampleButton && canAdd && onAddSample && (
          <button
            type="button"
            onClick={onAddSample}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-slate-100"
          >
            + Gunakan Foto Simulasi
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {photos.map((ph, i) => (
          <div
            key={`${ph.url}-${i}`}
            className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
          >
            <img src={ph.url} alt={ph.name} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-2 right-2 rounded-full bg-slate-900/75 p-1.5 text-white transition hover:bg-slate-900"
              aria-label="Hapus foto"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        {canAdd && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-700 transition hover:border-brand hover:bg-brand/5">
            <ImagePlus className="size-6 text-brand" aria-hidden="true" />
            <span>Unggah foto</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => onAdd(e.target.files)}
              className="sr-only"
            />
          </label>
        )}
      </div>
    </div>
  );
}
