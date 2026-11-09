import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, CloudOff, ImagePlus, Link2, MapPinned, Send, Trash2 } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { REPORT_CATEGORY_LABELS, SAMPLE_DATA, WARTA_PROJECTS, getProject } from '../../data/wartaData';
import type { CitizenReport, ReportCategory, VerificationItem } from '../../types/warta';
import ExifCheckBadge, { EXIF_INVALID_TEXT, EXIF_VALID_TEXT } from '../common/ExifCheckBadge';
import MiniPinMap from '../map/MiniPinMap';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const MAX = 500;
const MIN = 20;

export default function ReportFormView() {
  const { selectedProjectId, selectProject, navigate, addReport, currentUser, setLoginOpen } = useWarta();
  const p = getProject(selectedProjectId ?? WARTA_PROJECTS[0].id);

  const [category, setCategory] = useState<ReportCategory | ''>('');
  const [narrative, setNarrative] = useState('');
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);
  const [exifValid, setExifValid] = useState(true);
  const [pin, setPin] = useState({ x: 50, y: 50 });
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<'draft' | 'sent' | null>(null);

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
    setPhotos((ps) => [...ps, ...files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) }))]);
    e.target.value = '';
  };

  const build = (status: CitizenReport['status']): CitizenReport => ({
    id: `rep-${Date.now()}`,
    projectId: p.id,
    projectTitle: p.title,
    spseCode: p.spseCode,
    category: category || 'belum_mulai',
    narrative: narrative || '(Draft tanpa deskripsi)',
    createdAt: 'Baru saja',
    status,
  });

  const saveDraft = () => {
    addReport(build('draft'));
    setDone('draft');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return setLoginOpen(true);
    const errs: string[] = [];
    if (!category) errs.push('Pilih salah satu kategori temuan.');
    if (narrative.trim().length < MIN) errs.push(`Deskripsi minimal ${MIN} karakter.`);
    if (photos.length === 0) errs.push('Unggah minimal 1 foto bukti.');
    setErrors(errs);
    if (errs.length) return;
    const r = build('menunggu');
    const item: VerificationItem = {
      id: `ver-${Date.now()}`,
      projectId: p.id,
      projectTitle: p.title,
      spseCode: p.spseCode,
      satker: p.satker,
      paguCompact: p.paguCompact,
      itemType: 'laporan_kondisi',
      categoryLabel: REPORT_CATEGORY_LABELS[r.category],
      authorDisplayName: currentUser,
      createdAt: 'Baru saja',
      distanceFromProject: SAMPLE_DATA ? 'Dalam radius area proyek' : undefined,
      exifValid: SAMPLE_DATA ? exifValid : undefined,
      exifNotice: SAMPLE_DATA ? (exifValid ? EXIF_VALID_TEXT : EXIF_INVALID_TEXT) : undefined,
      narrative: r.narrative,
      proposedAddress: p.locationDesc,
      coordinates: { lat: -6.1 - pin.y / 1000, lng: 106.8 + pin.x / 1000 },
      photoUrl: photos[0].url,
      votesAgree: 0,
      votesDisagree: 0,
      targetVotes: 3,
      voters: [],
      status: 'menunggu',
    };
    addReport(r, item);
    setDone('sent');
  };

  if (done)
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        <div className="animate-pop rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div
            className={`mx-auto mb-4 grid size-16 place-items-center rounded-full ${
              done === 'draft' ? 'bg-draft-bg' : 'bg-wait-bg'
            }`}
          >
            {done === 'draft' ? (
              <CloudOff className="size-8 text-draft-text" />
            ) : (
              <Send className="size-8 text-wait-text" />
            )}
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">
            {done === 'draft' ? 'Draft tersimpan di perangkat' : 'Laporan terkirim'}
          </h1>
          <p className="mb-6 text-base leading-relaxed text-slate-600">
            {done === 'draft'
              ? 'Status: Draft (lokal). Anda bisa melanjutkannya dari tab Profil Warga.'
              : 'Status: Menunggu verifikasi. Laporan akan otomatis terverifikasi setelah 3 warga menyetujui.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              id="done-profile"
              onClick={() => navigate('profil')}
              className="flex-1 rounded-xl border border-slate-300 py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
              Lihat di Profil
            </button>
            <button
              id="done-feed"
              onClick={() => navigate('verifikasi')}
              className="flex-1 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-dark"
            >
              Lihat Antrean Aduan
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-10 sm:px-6 sm:py-12"
      noValidate
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          id="report-back"
          onClick={() => navigate('verifikasi')}
          className="flex items-center gap-1.5 text-sm font-semibold text-action-border hover:underline"
        >
          <ArrowLeft className="size-4" /> Kembali ke Daftar Aduan
        </button>

        <button
          type="button"
          onClick={() => navigate('klaim', p.id)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <MapPinned className="size-4 text-brand" /> Klaim Titik Lokasi Proyek Ini
        </button>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">
          Buat Pengaduan Kondisi Lapangan
        </h1>
        <p className="text-base leading-relaxed text-slate-600">
          Laporkan kondisi fisik proyek pemerintah di sekitar tempat tinggal Anda beserta bukti foto lapangan.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-brand-dark bg-brand p-6 text-white">
        <div className="space-y-1">
          <label htmlFor="report-project-select" className="block text-xs font-bold tracking-wide text-sky-100 uppercase">
            Pilih Paket Proyek yang Dilaporkan
          </label>
          <Select value={p.id} onValueChange={(id) => selectProject(id)}>
            <SelectTrigger
              id="report-project-select"
              aria-label="Pilih paket proyek"
              className="mt-1 h-12 border-white/25 bg-white text-base font-bold text-slate-900"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WARTA_PROJECTS.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.title} (#{proj.spseCode} · {proj.paguCompact})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-sky-100">
          <span className="font-mono">
            Kode Tender #{p.spseCode} · Pagu {p.paguCompact}
          </span>
          <span>{p.locationDesc}</span>
        </div>

        <p className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm text-sky-50">
          <Link2 className="size-4 shrink-0" />
          Setiap pengaduan warga terikat langsung pada satu paket proyek SPSE untuk menjaga akuntabilitas data.
        </p>
      </div>

      {errors.length > 0 && (
        <ul
          role="alert"
          className="list-inside list-disc space-y-1 rounded-xl border border-bad-border bg-bad-bg p-4 text-sm font-medium text-bad-text"
        >
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-6">
        <legend className="px-1 text-base font-bold text-slate-900">1. Kategori temuan *</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 text-sm transition ${
                category === k
                  ? 'border-action-border bg-action-bg font-semibold text-action-text'
                  : 'border-slate-200 text-slate-800 hover:border-slate-400'
              }`}
            >
              <input
                id={`cat-${k}`}
                type="radio"
                name="category"
                checked={category === k}
                onChange={() => setCategory(k)}
                className="size-4 accent-brand"
              />
              {REPORT_CATEGORY_LABELS[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <label htmlFor="report-narrative" className="mb-2 block text-base font-bold text-slate-900">
          2. Deskripsi kondisi lapangan *
        </label>
        <textarea
          id="report-narrative"
          value={narrative}
          maxLength={MAX}
          onChange={(e) => setNarrative(e.target.value)}
          rows={4}
          placeholder="Ceritakan apa yang Anda lihat: aktivitas pekerja, kondisi fisik, atau papan proyek…"
          className="w-full rounded-xl border border-slate-300 p-3.5 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-action-border focus:ring-2 focus:ring-action-border/30"
        />
        <p className={`mt-2 text-right text-xs font-medium ${narrative.length < MIN ? 'text-slate-600' : 'text-ok-text'}`}>
          {narrative.length}/{MAX} karakter (min. {MIN})
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="mb-3 text-base font-bold text-slate-900">
          3. Foto bukti lapangan * <span className="text-sm font-normal text-slate-600">(min. 1, maks. 4)</span>
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((ph, i) => (
            <div key={ph.url} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200">
              <img src={ph.url} alt={ph.name} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Hapus foto"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {photos.length < 4 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-action-border bg-action-bg text-sm font-semibold text-action-text transition hover:bg-sky-100">
              <ImagePlus className="size-6" /> Tambah foto
              <input id="report-photo" type="file" accept="image/*" multiple onChange={onFiles} className="sr-only" />
            </label>
          )}
        </div>
        {photos.length > 0 && SAMPLE_DATA && (
          <div className="mt-4 space-y-2">
            <ExifCheckBadge valid={exifValid} />
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                id="sim-exif"
                type="checkbox"
                checked={!exifValid}
                onChange={(e) => setExifValid(!e.target.checked)}
                className="accent-amber-600"
              />
              Simulasikan foto tanpa geotag / koordinat tidak cocok
            </label>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="mb-3 text-base font-bold text-slate-900">4. Titik pengamatan</p>
        <MiniPinMap value={pin} onChange={setPin} />
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="button"
          id="report-draft"
          onClick={saveDraft}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-draft-border bg-draft-bg py-3.5 text-base font-semibold text-draft-text hover:brightness-95"
        >
          <CloudOff className="size-5" /> Simpan Draft Offline
        </button>
        <button
          type="submit"
          id="report-submit"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-base font-bold text-white hover:bg-brand-dark"
        >
          <Send className="size-5" /> Kirim Pengaduan
        </button>
      </div>
    </form>
  );
}
