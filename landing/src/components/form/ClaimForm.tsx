import { ArrowLeft, MapPinned } from 'lucide-react';
import type { FormEvent } from 'react';
import { getProject } from '../../data/wartaData';
import { INPUT_CLASS, PRECISION_LEVELS } from '../../constants/formConfig';
import MiniPinMap from '../map/MiniPinMap';
import ExifCheckBadge from '../common/ExifCheckBadge';
import ErrorAlert from '../form/ErrorAlert';

interface Props {
  projectId: string;
  level: string;
  onLevelChange: (l: string) => void;
  claimAddress: string;
  onAddressChange: (a: string) => void;
  kelurahan: string;
  onKelurahanChange: (k: string) => void;
  kecamatan: string;
  onKecamatanChange: (k: string) => void;
  landmark: string;
  onLandmarkChange: (l: string) => void;
  claimPhoto: string | null;
  onPhotoChange: (p: string | null) => void;
  exifValid: boolean | undefined;
  onExifChange: (v: boolean) => void;
  pin: { x: number; y: number };
  onPinChange: (p: { x: number; y: number }) => void;
  errors: string[];
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}

export default function ClaimForm({
  projectId,
  level,
  onLevelChange,
  claimAddress,
  onAddressChange,
  kelurahan,
  onKelurahanChange,
  kecamatan,
  onKecamatanChange,
  landmark,
  onLandmarkChange,
  claimPhoto,
  onPhotoChange,
  exifValid,
  onExifChange,
  pin,
  onPinChange,
  errors,
  onSubmit,
  onBack,
}: Props) {
  const p = getProject(projectId);

  const handlePhotoInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onPhotoChange(URL.createObjectURL(file));
    }
  };

  const handleRemovePhoto = () => {
    onPhotoChange(null);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke beranda aduan
      </button>

      {/* Project info */}
      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900">Usulkan Titik Lokasi Pasti</h1>
          <p className="text-sm text-slate-600">
            Setiap laporan atau klaim lokasi wajib terikat pada satu paket proyek SPSE.
          </p>
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-5">
          <div>
            <label
              htmlFor="select-project-package"
              className="mb-1.5 block text-sm font-semibold text-slate-800"
            >
              Paket proyek yang diamati
            </label>
            <select id="select-project-package" disabled value={projectId} className={INPUT_CLASS}>
              <option value={p.id}>
                {p.title} · #{p.spseCode} ({p.paguCompact})
              </option>
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <span>
              Satker: <b className="text-slate-800">{p.satker}</b>
            </span>
            <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
              {p.precisionBadge}: {p.locationDesc}
            </span>
          </div>
        </div>
      </section>

      {/* Errors */}
      <ErrorAlert errors={errors} />

      {/* Precision level */}
      <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <legend className="px-1 text-base font-bold text-slate-900">
          1. Tingkat presisi lokasi *
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PRECISION_LEVELS.map(({ v, l }) => (
            <label
              key={v}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-base transition ${
                level === v
                  ? 'border-brand bg-brand/5 font-semibold text-slate-900'
                  : 'border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="precision"
                checked={level === v}
                onChange={() => onLevelChange(v)}
                className="accent-brand"
              />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Address details */}
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        {(level === 'alamat/ruas' || level === 'titik') && (
          <div>
            <label htmlFor="claim-address" className="mb-1.5 block text-base font-bold text-slate-900">
              2. Alamat atau nama ruas jalan *
            </label>
            <input
              id="claim-address"
              type="text"
              value={claimAddress}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="Contoh: Jl. Gatot Subroto No. 10A atau Ruas Jalan Penjaringan—Ancol"
              className={INPUT_CLASS}
            />
          </div>
        )}

        {(level === 'desa/kelurahan' || level === 'alamat/ruas' || level === 'titik') && (
          <div>
            <label
              htmlFor="claim-kelurahan"
              className="mb-1.5 block text-base font-bold text-slate-900"
            >
              Kelurahan / Desa
            </label>
            <input
              id="claim-kelurahan"
              type="text"
              value={kelurahan}
              onChange={(e) => onKelurahanChange(e.target.value)}
              placeholder="Contoh: Kelurahan Gatot Subroto"
              className={INPUT_CLASS}
            />
          </div>
        )}

        <div>
          <label htmlFor="claim-kecamatan" className="mb-1.5 block text-base font-bold text-slate-900">
            3. Kecamatan *
          </label>
          <input
            id="claim-kecamatan"
            type="text"
            value={kecamatan}
            onChange={(e) => onKecamatanChange(e.target.value)}
            placeholder="Contoh: Kecamatan Menteng"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="claim-landmark" className="mb-1.5 block text-base font-bold text-slate-900">
            4. Patokan lapangan (opsional)
          </label>
          <input
            id="claim-landmark"
            type="text"
            value={landmark}
            onChange={(e) => onLandmarkChange(e.target.value)}
            placeholder="Contoh: dekat SD Negeri 123 atau di depan pasar tradisional"
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {/* Photo */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="mb-4 text-base font-bold text-slate-900">
          5. Foto papan informasi proyek *
        </p>

        {claimPhoto ? (
          <div className="space-y-3">
            <div className="relative aspect-square max-w-xs overflow-hidden rounded-xl border border-slate-200">
              <img src={claimPhoto} alt="Claim photo" className="size-full object-cover" />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="absolute top-2 right-2 rounded-full bg-slate-900/75 p-1.5 text-white hover:bg-slate-900"
                aria-label="Hapus foto"
              >
                ✕
              </button>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={exifValid === false}
                onChange={(e) => onExifChange(!e.target.checked)}
                className="accent-brand"
              />
              Simulasikan foto tanpa geotag EXIF
            </label>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 py-8 text-sm font-semibold text-slate-700 transition hover:border-brand hover:bg-brand/5">
            <MapPinned className="size-6 text-brand" aria-hidden="true" />
            <span>Unggah foto</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoInput}
              className="sr-only"
            />
          </label>
        )}

        {claimPhoto && (
          <div className="mt-3">
            <ExifCheckBadge valid={exifValid ?? true} />
          </div>
        )}
      </div>

      {/* Pin */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="mb-3 text-base font-bold text-slate-900">6. Titik koordinat usulan</p>
        <MiniPinMap value={pin} onChange={onPinChange} />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-white transition hover:bg-brand-dark"
      >
        <MapPinned className="inline size-4 mr-2" aria-hidden="true" /> Kirim Klaim Lokasi ke
        Verifikasi
      </button>
    </form>
  );
}
