import { AlertTriangle, MapPinCheck, MapPinX } from 'lucide-react';

export const EXIF_VALID_TEXT = 'Foto cocok dengan lokasi (Geotag valid)';
export const EXIF_INVALID_TEXT = 'Koordinat EXIF tidak cocok / tidak ditemukan';

interface ExifCheckBadgeProps {
  valid?: boolean;
  status?: string;
  notice?: string | null;
}

export default function ExifCheckBadge({ valid, status, notice }: ExifCheckBadgeProps) {
  const isValid = valid === true || status === 'valid';
  const isSuspicious = status === 'mismatch' || status === 'stripped';

  let badgeText = isValid ? EXIF_VALID_TEXT : EXIF_INVALID_TEXT;
  if (notice) {
    badgeText = notice;
  } else if (status === 'mismatch') {
    badgeText = 'Koordinat EXIF berbeda jauh dari lokasi proyek';
  } else if (status === 'stripped') {
    badgeText = 'Data metadata GPS tidak ditemukan pada berkas foto';
  }

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium ${
        isValid
          ? 'bg-ok-bg border-ok-border text-ok-text'
          : isSuspicious
          ? 'bg-bad-bg border-bad-border text-bad-text'
          : 'bg-wait-bg border-wait-border text-wait-text'
      }`}
    >
      {isValid ? (
        <MapPinCheck className="size-4 shrink-0" />
      ) : isSuspicious ? (
        <AlertTriangle className="size-4 shrink-0" />
      ) : (
        <MapPinX className="size-4 shrink-0" />
      )}
      <span>{badgeText}</span>
    </div>
  );
}

