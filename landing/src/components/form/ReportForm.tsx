import { ArrowLeft, Camera } from 'lucide-react';
import type { ChangeEvent, FormEvent } from 'react';
import { REPORT_CATEGORY_LABELS, SAMPLE_DATA, getProject } from '../../data/wartaData';
import type { ReportCategory } from '../../types/warta';
import { INPUT_CLASS, MAX_NARRATIVE, MIN_NARRATIVE, SAMPLE_PHOTOS } from '../../constants/formConfig';
import { PRECISION_LEVELS } from '../../constants/formConfig';
import MiniPinMap from '../map/MiniPinMap';
import ExifCheckBadge, { EXIF_INVALID_TEXT, EXIF_VALID_TEXT } from '../common/ExifCheckBadge';
import ErrorAlert from '../form/ErrorAlert';
import PhotoUpload from '../form/PhotoUpload';

interface Props {
  projectId: string;
  editingDraftId: string | null;
  category: ReportCategory | '';
  onCategoryChange: (c: ReportCategory | '') => void;
  narrative: string;
  onNarrativeChange: (n: string) => void;
  proposedAddress: string;
  onAddressChange: (a: string) => void;
  photos: { name: string; url: string }[];
  onPhotosAdd: (files: FileList | null) => void;
  onPhotosRemove: (index: number) => void;
  exifValid: boolean | undefined;
  onExifChange: (v: boolean) => void;
  pin: { x: number; y: number };
  onPinChange: (p: { x: number; y: number }) => void;
  errors: string[];
  onDraft: () => void;
  onSubmit: (e: FormEvent) => void;
  onBack: () => void;
}

export default function ReportForm({
  projectId,
  editingDraftId,
  category,
  onCategoryChange,
  narrative,
  onNarrativeChange,
  proposedAddress,
  onAddressChange,
  photos,
  onPhotosAdd,
  onPhotosRemove,
  exifValid,
  onExifChange,
  pin,
  onPinChange,
  errors,
  onDraft,
  onSubmit,
  onBack,
}: Props) {
  const p = getProject(projectId);

  const addSamplePhoto = () => {
    if (photos.length >= 4) return;
    const nextUrl = SAMPLE_PHOTOS[photos.length % SAMPLE_PHOTOS.length];
    onPhotosAdd(null);
    // Simulates adding photo by directly updating state (caller handles setState)
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke beranda aduan
        </button>
        {editingDraftId && (
          <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            Melanjutkan draf #{editingDraftId}
          </span>
        )}
      </div>

      {/* Project selector + meta */}
      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900">
            Buat Pengaduan Kondisi Proyek
          </h1>
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
            <select
              id="select-project-package"
              disabled
              value={projectId}
              className={INPUT_CLASS}
            >
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

      {/* 1. Category */}
      <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <legend className="px-1 text-base font-bold text-slate-900">
          1. Kategori kondisi lapangan *
        </legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-base transition ${
                category === k
                  ? 'border-brand bg-brand/5 font-semibold text-slate-900'
                  : 'border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <input
                type="radio"
                name="category"
                checked={category === k}
                onChange={() => onCategoryChange(k)}
                className="accent-brand"
              />
              {REPORT_CATEGORY_LABELS[k]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* 2. Address & Narrative */}
      <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div>
          <label htmlFor="report-address" className="mb-1.5 block text-base font-bold text-slate-900">
            2. Alamat atau patokan lokasi pengamatan *
          </label>
          <input
            id="report-address"
            type="text"
            value={proposedAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Contoh: Sisi selatan Jl. Rorotan IX, dekat gerbang utama proyek"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label
            htmlFor="report-narrative"
            className="mb-1.5 block text-base font-bold text-slate-900"
          >
            3. Deskripsi kondisi fisik di lapangan *
          </label>
          <textarea
            id="report-narrative"
            value={narrative}
            maxLength={MAX_NARRATIVE}
            onChange={(e) => onNarrativeChange(e.target.value)}
            rows={4}
            placeholder="Jelaskan kondisi aktual yang Anda temukan..."
            className={INPUT_CLASS}
          />
          <div className="mt-2 flex justify-between text-sm text-slate-600">
            <span>Wajib {MIN_NARRATIVE} sampai {MAX_NARRATIVE} karakter saat dikirim</span>
            <span
              className={`font-semibold tabular-nums ${
                narrative.trim().length < MIN_NARRATIVE ? 'text-slate-600' : 'text-ok-text'
              }`}
            >
              {narrative.length}/{MAX_NARRATIVE}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Photos */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-base font-bold text-slate-900">
              4. Foto bukti lapangan * <span className="text-sm font-normal text-slate-600">(1–4)</span>
            </p>
            <p className="mt-1 text-sm text-slate-600">Ekstrak EXIF otomatis untuk validasi jarak.</p>
          </div>
          {SAMPLE_DATA && photos.length < 4 && (
            <button
              type="button"
              onClick={addSamplePhoto}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-slate-100"
            >
              + Gunakan Foto Simulasi
            </button>
          )}
        </div>

        <PhotoUpload
          photos={photos}
          onAdd={onPhotosAdd}
          onRemove={onPhotosRemove}
          maxPhotos={4}
          showSampleButton={false}
        />

        {SAMPLE_DATA && photos.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <ExifCheckBadge valid={exifValid ?? true} />
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
        )}
      </div>

      {/* 5. Pin */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="mb-3 text-base font-bold text-slate-900">5. Titik koordinat pengamatan</p>
        <MiniPinMap value={pin} onChange={onPinChange} />
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onDraft}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3.5 text-base font-semibold text-slate-800 transition hover:bg-slate-50"
        >
          <CloudOff className="size-4" aria-hidden="true" />
          {editingDraftId ? 'Simpan Perubahan Draf' : 'Simpan sebagai Draf'}
        </button>
        <button
          type="submit"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-base font-semibold text-white transition hover:bg-brand-dark"
        >
          <Send className="size-4" aria-hidden="true" /> Kirim Pengaduan ke Verifikasi
        </button>
      </div>
    </form>
  );
}
