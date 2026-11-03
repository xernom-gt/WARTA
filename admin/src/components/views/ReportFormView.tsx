import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, CloudOff, ImagePlus, Link2, Send, Trash2 } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { REPORT_CATEGORY_LABELS, WARTA_PROJECTS, getProject } from '../../data/wartaData';
import type { CitizenReport, ReportCategory, VerificationItem } from '../../types/warta';
import ExifCheckBadge, { EXIF_INVALID_TEXT, EXIF_VALID_TEXT } from '../common/ExifCheckBadge';
import MiniPinMap from '../map/MiniPinMap';

const MAX = 500;
const MIN = 20;

export default function ReportFormView() {
  const { selectedProjectId, navigate, addReport, currentUser, setLoginOpen } = useWarta();
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
      distanceFromProject: 'Dalam radius area proyek',
      exifValid,
      exifNotice: exifValid ? EXIF_VALID_TEXT : EXIF_INVALID_TEXT,
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
      <div className="mx-auto w-full max-w-lg flex-1 p-4">
        <div className="animate-pop rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className={`mx-auto mb-4 grid size-16 place-items-center rounded-full ${done === 'draft' ? 'bg-draft-bg' : 'bg-wait-bg'}`}>
            {done === 'draft' ? <CloudOff className="size-8 text-draft-text" /> : <Send className="size-8 text-wait-text" />}
          </div>
          <h1 className="mb-1 text-xl font-bold">{done === 'draft' ? 'Draft tersimpan di perangkat' : 'Laporan terkirim'}</h1>
          <p className="mb-6 text-sm text-slate-600">
            {done === 'draft'
              ? 'Status: Draft (lokal). Anda bisa melanjutkannya dari tab Profil.'
              : 'Status: Menunggu verifikasi. Laporan akan otomatis terverifikasi setelah 3 warga menyetujui.'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button id="done-profile" onClick={() => navigate('profil')} className="flex-1 rounded-xl border border-slate-300 py-2.5 font-semibold hover:bg-slate-50">Lihat di Profil</button>
            <button id="done-map" onClick={() => navigate('peta')} className="flex-1 rounded-xl bg-brand py-2.5 font-semibold text-white hover:bg-brand-dark">Kembali ke Peta</button>
          </div>
        </div>
      </div>
    );

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4" noValidate>
      <button type="button" id="report-back" onClick={() => navigate('detail', p.id)} className="flex items-center gap-1 text-sm font-semibold text-action-border hover:underline">
        <ArrowLeft className="size-4" /> Kembali ke detail
      </button>
      <h1 className="text-2xl font-extrabold text-slate-900">Laporkan Kondisi Lapangan</h1>

      {/* Paket terkunci */}
      <div className="rounded-2xl border border-brand-dark bg-brand p-4 text-white">
        <p className="text-xs uppercase tracking-wide text-sky-200">Paket yang dilaporkan</p>
        <p className="font-bold">{p.title}</p>
        <p className="font-mono text-sm text-sky-100">#{p.spseCode} • Pagu {p.paguCompact}</p>
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
          <Link2 className="size-4 shrink-0" />Laporan selalu terikat pada satu paket. Tidak ada laporan lepas.
        </p>
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="list-inside list-disc rounded-xl border border-bad-border bg-bad-bg p-3 text-sm text-bad-text">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-4">
        <legend className="px-1 text-sm font-bold">1. Kategori temuan *</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map((k) => (
            <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm transition ${category === k ? 'border-action-border bg-action-bg font-semibold text-action-text' : 'border-slate-200 hover:border-slate-400'}`}>
              <input id={`cat-${k}`} type="radio" name="category" checked={category === k} onChange={() => setCategory(k)} className="accent-brand" />
              {REPORT_CATEGORY_LABELS[k]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label htmlFor="report-narrative" className="mb-2 block text-sm font-bold">2. Deskripsi kondisi lapangan *</label>
        <textarea id="report-narrative" value={narrative} maxLength={MAX} onChange={(e) => setNarrative(e.target.value)} rows={4} placeholder="Ceritakan apa yang Anda lihat: aktivitas pekerja, kondisi fisik, papan proyek…" className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-action-border" />
        <p className={`text-right text-xs ${narrative.length < MIN ? 'text-slate-400' : 'text-ok-text'}`}>{narrative.length}/{MAX} karakter (min. {MIN})</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-bold">3. Foto bukti * <span className="font-normal text-slate-500">(min. 1, maks. 4)</span></p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((ph, i) => (
            <div key={ph.url} className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200">
              <img src={ph.url} alt={ph.name} className="size-full object-cover" />
              <button type="button" onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100" aria-label="Hapus foto">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
          {photos.length < 4 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-action-border bg-action-bg text-xs font-semibold text-action-text transition hover:bg-sky-100">
              <ImagePlus className="size-6" /> Tambah foto
              <input id="report-photo" type="file" accept="image/*" multiple onChange={onFiles} className="sr-only" />
            </label>
          )}
        </div>
        {photos.length > 0 && (
          <div className="mt-3 space-y-2">
            <ExifCheckBadge valid={exifValid} />
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <input id="sim-exif" type="checkbox" checked={!exifValid} onChange={(e) => setExifValid(!e.target.checked)} className="accent-amber-600" />
              Simulasikan foto tanpa geotag / koordinat tidak cocok
            </label>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-bold">4. Titik pengamatan</p>
        <MiniPinMap value={pin} onChange={setPin} />
      </div>

      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-slate-200 bg-slate-50/95 p-4 backdrop-blur sm:flex-row">
        <button type="button" id="report-draft" onClick={saveDraft} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-draft-border bg-draft-bg py-3 font-semibold text-draft-text hover:brightness-95">
          <CloudOff className="size-4" /> Simpan Draft Offline
        </button>
        <button type="submit" id="report-submit" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-dark">
          <Send className="size-4" /> Kirim Laporan Kondisi
        </button>
      </div>
    </form>
  );
}
