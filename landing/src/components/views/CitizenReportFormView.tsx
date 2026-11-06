import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowLeft,
  Camera,
  CloudOff,
  ImagePlus,
  Info,
  MapPinned,
  Send,
  Trash2,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { REPORT_CATEGORY_LABELS, WARTA_PROJECTS, getProject } from '../../data/wartaData';
import type {
  CitizenClaim,
  CitizenReport,
  PrecisionLevel,
  ReportCategory,
  VerificationItem,
} from '../../types/warta';
import ExifCheckBadge, { EXIF_INVALID_TEXT, EXIF_VALID_TEXT } from '../common/ExifCheckBadge';
import MiniPinMap from '../map/MiniPinMap';

const MAX_NARRATIVE = 500;
const MIN_NARRATIVE = 20;

const PRECISION_LEVELS: { v: PrecisionLevel; l: string }[] = [
  { v: 'titik', l: 'Titik Koordinat Pasti' },
  { v: 'alamat/ruas', l: 'Ruas Jalan / Alamat' },
  { v: 'desa/kelurahan', l: 'Kelurahan / Desa' },
  { v: 'kecamatan', l: 'Kecamatan' },
];

export default function CitizenReportFormView() {
  const {
    activeScreen,
    selectedProjectId,
    selectProject,
    editingDraftId,
    myReports,
    navigate,
    addReport,
    updateDraftReport,
    addClaim,
    currentUser,
    setLoginOpen,
  } = useWarta();

  const editingDraft = myReports.find((r) => r.id === editingDraftId) ?? null;
  const currentProjectId = editingDraft?.projectId ?? selectedProjectId ?? WARTA_PROJECTS[0].id;
  const p = getProject(currentProjectId);

  const formMode = activeScreen === 'klaim' ? 'klaim' : 'lapor';

  // State Form Laporan Kondisi
  const [category, setCategory] = useState<ReportCategory | ''>(editingDraft?.category ?? '');
  const [narrative, setNarrative] = useState(editingDraft?.narrative ?? '');
  const [proposedAddress, setProposedAddress] = useState(
    editingDraft?.proposedAddress ?? p.locationDesc,
  );
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>(
    editingDraft?.photoUrls?.map((u, idx) => ({ name: `foto-${idx + 1}.jpg`, url: u })) ?? [],
  );
  const [exifValid, setExifValid] = useState(editingDraft?.exifValid ?? true);
  const [pin, setPin] = useState({ x: 52, y: 48 });
  const [reportErrors, setReportErrors] = useState<string[]>([]);
  const [doneState, setDoneState] = useState<'draft' | 'sent' | 'claim-sent' | null>(null);

  // State Form Klaim Lokasi
  const [level, setLevel] = useState<PrecisionLevel>('alamat/ruas');
  const [claimAddress, setClaimAddress] = useState('');
  const [kelurahan, setKelurahan] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [landmark, setLandmark] = useState('');
  const [claimPhoto, setClaimPhoto] = useState<string | null>(null);
  const [claimErrors, setClaimErrors] = useState<string[]>([]);

  const onProjectChange = (nextProjectId: string) => {
    selectProject(nextProjectId);
    const nextProj = getProject(nextProjectId);
    if (!editingDraft) {
      setProposedAddress(nextProj.locationDesc);
    }
  };

  const onReportFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length);
    setPhotos((prev) => [
      ...prev,
      ...files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    ]);
    e.target.value = '';
  };

  const addSamplePhoto = () => {
    if (photos.length >= 4) return;
    const samples = [
      '/photos/rusun-rorotan.svg',
      '/photos/sekolah-tebet.svg',
      '/photos/tpst-bantargebang.svg',
    ];
    const nextUrl = samples[photos.length % samples.length];
    setPhotos((prev) => [...prev, { name: `bukti-lapangan-${prev.length + 1}.jpg`, url: nextUrl }]);
  };

  const buildReport = (status: CitizenReport['status']): CitizenReport => ({
    id: editingDraft?.id ?? `rep-${Date.now()}`,
    projectId: p.id,
    projectTitle: p.title,
    spseCode: p.spseCode,
    category: category || 'belum_mulai',
    narrative: narrative.trim() || '(Draf tanpa deskripsi)',
    proposedAddress: proposedAddress.trim() || p.locationDesc,
    photoUrls: photos.map((ph) => ph.url),
    exifValid,
    distanceFromProject: '85 m dari area proyek',
    createdAt: 'Baru saja',
    status,
  });

  const handleSaveDraft = () => {
    const draftObj = buildReport('draft');
    if (editingDraft) {
      updateDraftReport(editingDraft.id, draftObj);
    } else {
      addReport(draftObj);
    }
    setDoneState('draft');
  };

  const handleSubmitReport = (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setLoginOpen(true);
      return;
    }
    const errs: string[] = [];
    if (!category) errs.push('Pilih salah satu kategori kondisi lapangan.');
    if (!proposedAddress.trim()) errs.push('Isi alamat atau titik lokasi pengamatan.');
    if (narrative.trim().length < MIN_NARRATIVE)
      errs.push(`Deskripsi pengamatan minimal ${MIN_NARRATIVE} karakter.`);
    if (photos.length === 0) errs.push('Unggah minimal 1 foto bukti lapangan (maksimal 4 foto).');
    setReportErrors(errs);
    if (errs.length > 0) return;

    const submitted = buildReport('menunggu');
    const queueItem: VerificationItem = {
      id: `ver-${Date.now()}`,
      projectId: p.id,
      projectTitle: p.title,
      spseCode: p.spseCode,
      satker: p.satker,
      paguCompact: p.paguCompact,
      itemType: 'laporan_kondisi',
      category: submitted.category,
      categoryLabel: REPORT_CATEGORY_LABELS[submitted.category],
      authorDisplayName: currentUser,
      createdAt: 'Baru saja',
      distanceFromProject: '85 m dari area proyek',
      exifValid,
      exifNotice: exifValid ? EXIF_VALID_TEXT : EXIF_INVALID_TEXT,
      narrative: submitted.narrative,
      proposedAddress: submitted.proposedAddress ?? p.locationDesc,
      coordinates: { lat: -6.1 - pin.y / 1000, lng: 106.8 + pin.x / 1000 },
      photoUrl: photos[0].url,
      photoUrls: photos.map((ph) => ph.url),
      votesAgree: 0,
      votesDisagree: 0,
      targetVotes: 3,
      voters: [],
      status: 'menunggu',
      evidences: [],
    };

    if (editingDraft) {
      updateDraftReport(editingDraft.id, submitted, queueItem);
    } else {
      addReport(submitted, queueItem);
    }
    setDoneState('sent');
  };

  const handleSubmitClaim = (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      setLoginOpen(true);
      return;
    }
    const errs: string[] = [];
    if (!claimAddress.trim() && level !== 'kecamatan' && level !== 'desa/kelurahan') {
      errs.push('Isi alamat spesifik atau nama ruas jalan.');
    }
    if (!kecamatan.trim()) errs.push('Isi nama kecamatan.');
    if (!claimPhoto) errs.push('Unggah 1 foto papan informasi proyek.');
    setClaimErrors(errs);
    if (errs.length > 0 || !claimPhoto) return;

    const proposed = [
      claimAddress.trim(),
      kelurahan.trim() && `Kel. ${kelurahan.trim()}`,
      `Kec. ${kecamatan.trim()}`,
      landmark.trim() && `(dekat ${landmark.trim()})`,
    ]
      .filter(Boolean)
      .join(', ');

    const claim: CitizenClaim = {
      id: `clm-${Date.now()}`,
      projectId: p.id,
      projectTitle: p.title,
      spseCode: p.spseCode,
      proposedAddress: proposed,
      proposedPrecision: level,
      photoUrl: claimPhoto,
      createdAt: 'Baru saja',
      status: 'menunggu',
    };

    const item: VerificationItem = {
      id: `ver-${Date.now()}`,
      projectId: p.id,
      projectTitle: p.title,
      spseCode: p.spseCode,
      satker: p.satker,
      paguCompact: p.paguCompact,
      itemType: 'klaim_lokasi',
      categoryLabel: 'Klaim Lokasi Kanonik',
      authorDisplayName: currentUser,
      createdAt: 'Baru saja',
      distanceFromProject: 'Dalam area perkiraan SPSE',
      exifValid,
      exifNotice: exifValid ? EXIF_VALID_TEXT : EXIF_INVALID_TEXT,
      narrative: landmark.trim() ? `Patokan lapangan: ${landmark.trim()}` : 'Usulan titik lokasi kanonik paket.',
      proposedAddress: proposed,
      proposedPrecision: level,
      coordinates: { lat: -6.1 - pin.y / 1000, lng: 106.8 + pin.x / 1000 },
      photoUrl: claimPhoto,
      photoUrls: [claimPhoto],
      votesAgree: 0,
      votesDisagree: 0,
      targetVotes: 3,
      voters: [],
      status: 'menunggu',
      evidences: [],
    };

    addClaim(claim, item);
    setDoneState('claim-sent');
  };

  if (doneState) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div
            className={`mx-auto mb-4 grid size-14 place-items-center rounded-full ${
              doneState === 'draft' ? 'bg-slate-100 text-slate-700' : 'bg-ok-bg text-ok-text'
            }`}
          >
            {doneState === 'draft' ? <CloudOff className="size-7" /> : <Send className="size-7" />}
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {doneState === 'draft'
              ? 'Draf pengaduan disimpan'
              : doneState === 'claim-sent'
                ? 'Klaim lokasi berhasil dikirim'
                : 'Pengaduan berhasil dikirim'}
          </h1>
          <p className="mt-1.5 mb-6 text-sm leading-relaxed text-slate-600">
            {doneState === 'draft'
              ? 'Draf tersimpan di akun Anda (`status: draft`). Anda dapat mengedit, melengkapi foto, atau mengirimnya kapan saja melalui menu Aduan Saya.'
              : 'Kiriman Anda kini berstatus Menunggu Verifikasi (`status: menunggu`) dan dapat dilihat oleh warga lain maupun tim verifikasi.'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('profil')}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Buka Aduan Saya
            </button>
            <button
              type="button"
              onClick={() => navigate('aduan')}
              className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Lihat Feed Aduan Warga
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate('peta')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
        >
          <ArrowLeft className="size-4" /> Kembali ke jelajah proyek
        </button>
        {editingDraft && (
          <span className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
            Melanjutkan draf #{editingDraft.id}
          </span>
        )}
      </div>

      {/* Pilihan Paket Proyek SPSE */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">
              {formMode === 'lapor' ? 'Buat Pengaduan Kondisi Proyek' : 'Usulkan Titik Lokasi Pasti'}
            </h1>
            <p className="text-xs text-slate-500">
              Setiap laporan atau klaim lokasi wajib terikat pada satu paket proyek SPSE.
            </p>
          </div>

          {/* Switcher Mode Lapor vs Klaim Lokasi */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => navigate('lapor', p.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                formMode === 'lapor' ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="size-3.5" /> Laporan Kondisi
            </button>
            <button
              type="button"
              onClick={() => navigate('klaim', p.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                formMode === 'klaim' ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPinned className="size-3.5" /> Klaim Lokasi
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <label htmlFor="select-project-package" className="mb-1 block text-xs font-semibold text-slate-600">
              Pilih paket proyek yang diamati
            </label>
            <select
              id="select-project-package"
              disabled={Boolean(editingDraft)}
              value={p.id}
              onChange={(e) => onProjectChange(e.target.value)}
              className={inputClass}
            >
              {WARTA_PROJECTS.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.title} — #{proj.spseCode} ({proj.paguCompact})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Satker: <b className="text-slate-800">{p.satker}</b>
            </span>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-medium text-slate-700">
              {p.precisionBadge} — {p.locationDesc}
            </span>
          </div>
        </div>
      </section>

      {formMode === 'lapor' ? (
        <form onSubmit={handleSubmitReport} className="space-y-5" noValidate>
          {reportErrors.length > 0 && (
            <ul
              role="alert"
              className="list-inside list-disc rounded-2xl border border-bad-border bg-bad-bg p-4 text-sm text-bad-text"
            >
              {reportErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {/* 1. Kategori Temuan */}
          <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
            <legend className="px-1 text-sm font-bold text-slate-900">
              1. Kategori kondisi lapangan *
            </legend>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {(Object.keys(REPORT_CATEGORY_LABELS) as ReportCategory[]).map((k) => (
                <label
                  key={k}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm transition ${
                    category === k
                      ? 'border-brand bg-brand/5 font-semibold text-slate-900'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    id={`cat-${k}`}
                    type="radio"
                    name="category"
                    checked={category === k}
                    onChange={() => setCategory(k)}
                    className="accent-brand"
                  />
                  {REPORT_CATEGORY_LABELS[k]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* 2. Narasi & Alamat Pengamatan */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <label htmlFor="report-address" className="mb-1 block text-sm font-bold text-slate-900">
                2. Alamat atau patokan lokasi pengamatan *
              </label>
              <input
                id="report-address"
                type="text"
                value={proposedAddress}
                onChange={(e) => setProposedAddress(e.target.value)}
                placeholder="Contoh: Sisi selatan Jl. Rorotan IX, dekat gerbang utama proyek"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="report-narrative" className="mb-1 block text-sm font-bold text-slate-900">
                3. Deskripsi kondisi fisik di lapangan *
              </label>
              <textarea
                id="report-narrative"
                value={narrative}
                maxLength={MAX_NARRATIVE}
                onChange={(e) => setNarrative(e.target.value)}
                rows={4}
                placeholder="Jelaskan kondisi aktual yang Anda temukan: apakah ada papan proyek, aktivitas pekerja, progres fisik, atau kerusakan…"
                className={inputClass}
              />
              <div className="mt-1 flex justify-between text-xs text-slate-500">
                <span>Wajib 20–500 karakter saat dikirim ke verifikasi</span>
                <span
                  className={`font-medium tabular-nums ${
                    narrative.trim().length < MIN_NARRATIVE ? 'text-slate-500' : 'text-ok-text'
                  }`}
                >
                  {narrative.length}/{MAX_NARRATIVE} karakter
                </span>
              </div>
            </div>
          </div>

          {/* 4. Foto Bukti & EXIF Check */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  4. Foto bukti lapangan *{' '}
                  <span className="font-normal text-slate-500">(min. 1, maks. 4 foto, maks. 5MB/foto)</span>
                </p>
                <p className="text-xs text-slate-500">
                  Server mengekstrak koordinat EXIF secara otomatis untuk memvalidasi jarak dari lokasi proyek.
                </p>
              </div>
              {photos.length < 4 && (
                <button
                  type="button"
                  onClick={addSamplePhoto}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-slate-100"
                >
                  + Gunakan Foto Simulasi
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((ph, i) => (
                <div
                  key={`${ph.url}-${i}`}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                >
                  <img src={ph.url} alt={ph.name} className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                    className="absolute top-1.5 right-1.5 rounded-full bg-slate-900/75 p-1.5 text-white transition hover:bg-slate-900"
                    aria-label="Hapus foto"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < 4 && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 transition hover:border-brand hover:bg-brand/5">
                  <ImagePlus className="size-6 text-brand" />
                  <span>Unggah foto</span>
                  <input
                    id="report-photo"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={onReportFiles}
                    className="sr-only"
                  />
                </label>
              )}
            </div>

            {photos.length > 0 && (
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <ExifCheckBadge valid={exifValid} />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input
                    id="sim-exif"
                    type="checkbox"
                    checked={!exifValid}
                    onChange={(e) => setExifValid(!e.target.checked)}
                    className="accent-brand"
                  />
                  Simulasikan foto tanpa geotag EXIF
                </label>
              </div>
            )}
          </div>

          {/* 5. Titik Pengamatan */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-2 text-sm font-bold text-slate-900">5. Titik koordinat pengamatan</p>
            <MiniPinMap value={pin} onChange={setPin} />
          </div>

          {/* Tombol Aksi (Draft-First / Submit) */}
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              id="report-draft"
              onClick={handleSaveDraft}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <CloudOff className="size-4" />
              {editingDraft ? 'Simpan Perubahan Draf' : 'Simpan sebagai Draf'}
            </button>
            <button
              type="submit"
              id="report-submit"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <Send className="size-4" /> Kirim Pengaduan ke Verifikasi
            </button>
          </div>
        </form>
      ) : (
        /* Form Klaim Lokasi Kanonik */
        <form onSubmit={handleSubmitClaim} className="space-y-5" noValidate>
          {claimErrors.length > 0 && (
            <ul
              role="alert"
              className="list-inside list-disc rounded-2xl border border-bad-border bg-bad-bg p-4 text-sm text-bad-text"
            >
              {claimErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <fieldset className="rounded-2xl border border-slate-200 bg-white p-5">
            <legend className="px-1 text-sm font-bold text-slate-900">
              1. Tingkat presisi lokasi yang diusulkan *
            </legend>
            <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
              {PRECISION_LEVELS.map((l) => (
                <label
                  key={l.v}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm transition ${
                    level === l.v
                      ? 'border-brand bg-brand/5 font-semibold text-slate-900'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    checked={level === l.v}
                    onChange={() => setLevel(l.v)}
                    className="accent-brand"
                  />
                  {l.l}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3.5 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
            <p className="text-sm font-bold text-slate-900 sm:col-span-2">2. Detail alamat usulan</p>
            <input
              id="claim-address"
              value={claimAddress}
              onChange={(e) => setClaimAddress(e.target.value)}
              placeholder="Alamat spesifik / nama jalan (wajib untuk titik & alamat/ruas)"
              className={`${inputClass} sm:col-span-2`}
            />
            <input
              id="claim-kelurahan"
              value={kelurahan}
              onChange={(e) => setKelurahan(e.target.value)}
              placeholder="Kelurahan / Desa"
              className={inputClass}
            />
            <input
              id="claim-kecamatan"
              value={kecamatan}
              onChange={(e) => setKecamatan(e.target.value)}
              placeholder="Kecamatan *"
              className={inputClass}
            />
            <input
              id="claim-landmark"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="Patokan fisik (contoh: seberang pintu air / depan sekolah)"
              className={`${inputClass} sm:col-span-2`}
            />
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900">
                3. Foto papan informasi proyek * <span className="font-normal text-slate-500">(1 foto)</span>
              </p>
              {!claimPhoto && (
                <button
                  type="button"
                  onClick={() => setClaimPhoto('/photos/tpst-bantargebang.svg')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-slate-100"
                >
                  + Gunakan Foto Simulasi
                </button>
              )}
            </div>

            {claimPhoto ? (
              <div className="space-y-2.5">
                <div className="relative overflow-hidden rounded-xl border border-slate-200">
                  <img src={claimPhoto} alt="Foto papan proyek" className="h-48 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setClaimPhoto(null)}
                    className="absolute top-2 right-2 rounded-lg bg-slate-900/75 px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    Ganti foto
                  </button>
                </div>
                <ExifCheckBadge valid={exifValid} />
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-700 hover:border-brand hover:bg-brand/5">
                <ImagePlus className="size-6 text-brand" />
                <span>Unggah foto papan proyek</span>
                <input
                  id="claim-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setClaimPhoto(URL.createObjectURL(f));
                  }}
                  className="sr-only"
                />
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-2 text-sm font-bold text-slate-900">4. Titik koordinat usulan</p>
            <MiniPinMap
              value={pin}
              onChange={setPin}
              estimate={{ x: 50, y: 50, r: 28 }}
              label="Lingkaran putus-putus: area perkiraan SPSE · Pin biru: titik usulan Anda"
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-600">
            <Info className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              Apabila 3 suara verifikasi menyetujui klaim lokasi ini, koordinat usulan Anda akan ditetapkan menjadi lokasi utama proyek dengan penanda <b>Sumber: Warga</b>.
            </span>
          </div>

          <button
            type="submit"
            id="claim-submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <Send className="size-4" /> Kirim Usulan Lokasi Proyek
          </button>
        </form>
      )}
    </div>
  );
}
