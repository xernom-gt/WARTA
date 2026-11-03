import { MapPinCheck, MapPinX } from 'lucide-react';

export const EXIF_VALID_TEXT = 'Foto cocok dengan lokasi (Geotag valid)';
export const EXIF_INVALID_TEXT = 'Koordinat EXIF tidak cocok / tidak ditemukan';

export default function ExifCheckBadge({ valid }: { valid: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
        valid ? 'bg-ok-bg border-ok-border text-ok-text' : 'bg-wait-bg border-wait-border text-wait-text'
      }`}
    >
      {valid ? <MapPinCheck className="size-4 shrink-0" /> : <MapPinX className="size-4 shrink-0" />}
      {valid ? EXIF_VALID_TEXT : EXIF_INVALID_TEXT}
    </div>
  );
}
