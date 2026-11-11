import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowLeft,
  Camera,
  CloudOff,
  ImagePlus,
  Info,
  Loader2,
  MapPinned,
  Send,
  Trash2,
} from 'lucide-react';
import axios from 'axios';
import { useWarta } from '../../context/WartaContext';
import {
  REPORT_CATEGORY_LABELS,
  SAMPLE_DATA,
  WARTA_PROJECTS,
  getProject,
} from '../../data/wartaData';
import type {
  CitizenClaim,
  CitizenReport,
  PrecisionLevel,
  ReportCategory,
  VerificationItem,
} from '../../types/warta';
import { reportsService } from '../../services/reports';
import ExifCheckBadge, { EXIF_INVALID_TEXT, EXIF_VALID_TEXT } from '../common/ExifCheckBadge';
import MiniPinMap, { type MiniPinValue } from '../map/MiniPinMap';

const MAX_NARRATIVE = 500;
const MIN_NARRATIVE = 20;

const PRECISION_LEVELS: { v: PrecisionLevel; l: string }[] = [
  { v: 'titik', l: 'Titik Koordinat Pasti' },
  { v: 'alamat/ruas', l: 'Ruas Jalan / Alamat' },
  { v: 'desa/kelurahan', l: 'Kelurahan / Desa' },
  { v: 'kecamatan', l: 'Kecamatan' },
];

export interface PhotoAttachment {
  name: string;
  url: string;
  file?: File;
}

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

  // Sesi draft storage keys
  const reportDraftKey = `warta_lapor_draft_${currentProjectId}`;
  const claimDraftKey = `warta_claim_draft_${currentProjectId}`;

  const savedReportDraft = useMemo(() => {
    if (editingDraft) return null;
    try {
      const raw = sessionStorage.getItem(reportDraftKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [editingDraft, reportDraftKey]);

  const savedClaimDraft = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(claimDraftKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [claimDraftKey]);

  // State Form Laporan Kondisi
  const [category, setCategory] = useState<ReportCategory | ''>(
    editingDraft?.category ?? savedReportDraft?.category ?? '',
  );
  const [narrative, setNarrative] = useState(
    editingDraft?.narrative ?? savedReportDraft?.narrative ?? '',
  );
  const [proposedAddress, setProposedAddress] = useState(
    editingDraft?.proposedAddress ?? savedReportDraft?.proposedAddress ?? p.locationDesc,
  );
  const [photos, setPhotos] = useState<PhotoAttachment[]>(
    editingDraft?.photoUrls?.map((u, idx) => ({ name: `foto-${idx + 1}.jpg`, url: u })) ?? [],
  );
  const [exifValid, setExifValid] = useState<boolean | undefined>(editingDraft?.exifValid);
  const [pin, setPin] = useState<MiniPinValue>(
    savedReportDraft?.pin ?? {
      x: 52,
      y: 48,
      lat: p.mapCoordinates?.lat,
      lng: p.mapCoordinates?.lng,
    },
  );

  const onPinChange = (nextPin: MiniPinValue) => {
    setPin(nextPin);
    // Jika di-reset kembali ke titik awal proyek, kembalikan teks alamat ke lokasi kanonik proyek
    if (
      p.mapCoordinates &&
      nextPin.lat !== undefined &&
      nextPin.lng !== undefined &&
      Math.abs(nextPin.lat - p.mapCoordinates.lat) < 0.00008 &&
      Math.abs(nextPin.lng - p.mapCoordinates.lng) < 0.00008
    ) {
      setProposedAddress(p.locationDesc);
    } else if (nextPin.address && (!proposedAddress || proposedAddress === p.locationDesc)) {
      setProposedAddress(nextPin.address);
    }
  };

  const pinLat = pin.lat ?? -6.1 - pin.y / 1000;
  const pinLng = pin.lng ?? 106.8 + pin.x / 1000;
  const [reportErrors, setReportErrors] = useState<string[]>([]);
  const [doneState, setDoneState] = useState<'draft' | 'sent' | 'claim-sent' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<string>('');

  // State Form Klaim Lokasi
  const [level, setLevel] = useState<PrecisionLevel>(savedClaimDraft?.level ?? 'alamat/ruas');
  const [claimAddress, setClaimAddress] = useState(savedClaimDraft?.claimAddress ?? '');
  const [kelurahan, setKelurahan] = useState(savedClaimDraft?.kelurahan ?? '');
  const [kecamatan, setKecamatan] = useState(savedClaimDraft?.kecamatan ?? '');
  const [landmark, setLandmark] = useState(savedClaimDraft?.landmark ?? '');
  const [claimPhoto, setClaimPhoto] = useState<string | null>(null);
  const [claimErrors, setClaimErrors] = useState<string[]>([]);

  // Auto-save draf laporan ke sessionStorage dengan debounce (bebas memory leak)
  useEffect(() => {
    if (editingDraft) return;
    const timer = setTimeout(() => {
      try {
        if (category || narrative || (proposedAddress && proposedAddress !== p.locationDesc)) {
          sessionStorage.setItem(
            reportDraftKey,
            JSON.stringify({ category, narrative, proposedAddress, pin }),
          );
        }
      } catch {
        // Abaikan jika storage disabled/quota
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [category, narrative, proposedAddress, pin, reportDraftKey, editingDraft, p.locationDesc]);

  // Auto-save draf klaim ke sessionStorage dengan debounce (bebas memory leak)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (claimAddress || kelurahan || kecamatan || landmark) {
          sessionStorage.setItem(
            claimDraftKey,
            JSON.stringify({ level, claimAddress, kelurahan, kecamatan, landmark }),
          );
        }
      } catch {
        // Abaikan jika storage disabled/quota
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [level, claimAddress, kelurahan, kecamatan, landmark, claimDraftKey]);

  // Pembersihan Blob URL ketika foto dihapus atau komponen unmount (bebas memory leak)
  useEffect(() => {
    return () => {
      photos.forEach((ph) => {
        if (ph.url.startsWith('blob:')) {
          URL.revokeObjectURL(ph.url);
        }
      });
    };
  }, [photos]);

  useEffect(() => {
    return () => {
      if (claimPhoto?.startsWith('blob:')) {
        URL.revokeObjectURL(claimPhoto);
      }
    };
  }, [claimPhoto]);

  const handleRemovePhoto = (indexToRemove: number) => {
    setPhotos((prev) => {
      const item = prev[indexToRemove];
      if (item?.url.startsWith('blob:')) {
        URL.revokeObjectURL(item.url);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  };

  const updateClaimPhoto = (nextUrl: string | null) => {
    setClaimPhoto((prev) => {
      if (prev?.startsWith('blob:')) {
        URL.revokeObjectURL(prev);
      }
      return nextUrl;
    });
  };

  const onProjectChange = (nextProjectId: string) => {
    selectProject(nextProjectId);
    const nextProj = getProject(nextProjectId);
    if (!editingDraft) {
      setProposedAddress(nextProj.locationDesc);
    }
  };

  const onReportFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files ?? []);
    e.target.value = '';

    const newErrors: string[] = [];
    const validAttachments: PhotoAttachment[] = [];
    const remainingSlots = 4 - photos.length;

    for (const file of rawFiles.slice(0, remainingSlots)) {
      if (file.size > 5 * 1024 * 1024) {
        newErrors.push(`File "${file.name}" melebihi batas 5 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        continue;
      }
      validAttachments.push({
        name: file.name,
        url: URL.createObjectURL(file),
        file,
      });
    }

    if (newErrors.length > 0) {
      setReportErrors((prev) => [...prev, ...newErrors]);
    }
    if (validAttachments.length > 0) {
      setPhotos((prev) => [...prev, ...validAttachments]);
    }
  };

  const addSamplePhoto = async () => {
    if (photos.length >= 4) return;
    const samples = [
      '/photos/rusun-rorotan.svg',
      '/photos/sekolah-tebet.svg',
      '/photos/tpst-bantargebang.svg',
    ];
    const nextUrl = samples[photos.length % samples.length];
    const name = `bukti-lapangan-${photos.length + 1}.svg`;

    try {
      const res = await fetch(nextUrl);
      const blob = await res.blob();
      const file = new File([blob], name, { type: 'image/svg+xml' });
      setPhotos((prev) => [...prev, { name, url: nextUrl, file }]);
    } catch {
      setPhotos((prev) => [...prev, { name, url: nextUrl }]);
    }
  };

  const buildReport = (status: CitizenReport['status']): CitizenReport => ({
    id: editingDraft?.id ?? `rep-${Date.now()}`,
    projectId: p.id,
    projectTitle: p.title,
    spseCode: p.spseCode,
    category: (category || 'belum_mulai') as ReportCategory,
    narrative: narrative.trim() || '(Draf tanpa deskripsi)',
    proposedAddress: proposedAddress.trim() || p.locationDesc,
    photoUrls: photos.map((ph) => ph.url),
    exifValid,
    createdAt: 'Baru saja',
    status,
  });

  const handleSaveDraft = async () => {
    if (!currentUser) {
      setLoginOpen(true);
      return;
    }
    setSubmitting(true);
    setSubmitStep('Menyimpan draft...');
    setReportErrors([]);

    const draftObj = buildReport('draft');

    try {
      let reportId = editingDraft?.id;
      if (editingDraft) {
        await reportsService.updateReport(editingDraft.id, {
          category: (category || undefined) as ReportCategory | undefined,
          narrative: narrative.trim() || undefined,
          proposed_address: proposedAddress.trim() || undefined,
          latitude: pinLat,
          longitude: pinLng,
        });
      } else {
        const created = await reportsService.createReport(p.id, {
          category: (category || undefined) as ReportCategory | undefined,
          narrative: narrative.trim() || 'Draf laporan kondisi warga',
          proposed_address: proposedAddress.trim() || undefined,
          latitude: pinLat,
          longitude: pinLng,
          submit: false,
        });
        reportId = created.id;
        draftObj.id = created.id;
      }

      if (reportId) {
        for (let i = 0; i < photos.length; i++) {
          const ph = photos[i];
          if (ph.file) {
            setSubmitStep(`Mengunggah foto bukti (${i + 1}/${photos.length})...`);
            try {
              await reportsService.uploadReportMedia(reportId, ph.file, i);
            } catch {
              // Ignore individual photo fail during draft save
            }
          }
        }
      }

      if (editingDraft) {
        updateDraftReport(editingDraft.id, draftObj);
      } else {
        addReport(draftObj);
      }
      try {
        sessionStorage.removeItem(reportDraftKey);
      } catch {
        // ignore
      }
      setDoneState('draft');
    } catch {
      // Offline fallback
      if (editingDraft) {
        updateDraftReport(editingDraft.id, draftObj);
      } else {
        addReport(draftObj);
      }
      try {
        sessionStorage.removeItem(reportDraftKey);
      } catch {
        // ignore
      }
      setDoneState('draft');
    } finally {
      setSubmitting(false);
      setSubmitStep('');
    }
  };

  const handleSubmitReport = async (e: FormEvent) => {
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

    setSubmitting(true);
    setSubmitStep('Menyiapkan laporan...');

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
      exifValid,
      exifNotice:
        typeof exifValid === 'boolean'
          ? exifValid
            ? EXIF_VALID_TEXT
            : EXIF_INVALID_TEXT
          : undefined,
      narrative: submitted.narrative,
      proposedAddress: submitted.proposedAddress ?? p.locationDesc,
      coordinates: { lat: pinLat, lng: pinLng },
      photoUrl: photos[0].url,
      photoUrls: photos.map((ph) => ph.url),
      votesAgree: 0,
      votesDisagree: 0,
      targetVotes: 3,
      voters: [],
      status: 'menunggu',
      evidences: [],
    };

    try {
      let reportId = editingDraft?.id;
      if (editingDraft) {
        setSubmitStep('Memperbarui draf laporan...');
        await reportsService.updateReport(editingDraft.id, {
          category: category as ReportCategory,
          narrative: narrative.trim(),
          proposed_address: proposedAddress.trim(),
          latitude: pinLat,
          longitude: pinLng,
        });
      } else {
        setSubmitStep('Membuat laporan baru...');
        const created = await reportsService.createReport(p.id, {
          category: category as ReportCategory,
          narrative: narrative.trim(),
          proposed_address: proposedAddress.trim(),
          latitude: pinLat,
          longitude: pinLng,
          submit: false,
        });
        reportId = created.id;
        submitted.id = created.id;
      }

      if (reportId) {
        for (let i = 0; i < photos.length; i++) {
          const ph = photos[i];
          if (ph.file) {
            setSubmitStep(`Mengunggah foto bukti (${i + 1}/${photos.length})...`);
            try {
              await reportsService.uploadReportMedia(reportId, ph.file, i);
            } catch {
              // Ignore or continue
            }
          }
        }

        setSubmitStep('Mengirim ke antrean verifikasi...');
        await reportsService.submitReport(reportId);
      }

      if (editingDraft) {
        updateDraftReport(editingDraft.id, submitted, queueItem);
      } else {
        addReport(submitted, queueItem);
      }
      try {
        sessionStorage.removeItem(reportDraftKey);
      } catch {
        // ignore
      }
      setDoneState('sent');
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        if (data?.error?.details && Array.isArray(data.error.details) && data.error.details.length > 0) {
          setReportErrors(
            data.error.details.map((d: { message?: string; field?: string }) => d.message || d.field || 'Validasi gagal'),
          );
          return;
        }
        if (data?.error?.message) {
          setReportErrors([data.error.message]);
          return;
        }
      }
      // If network error / offline fallback
      if (editingDraft) {
        updateDraftReport(editingDraft.id, submitted, queueItem);
      } else {
        addReport(submitted, queueItem);
      }
      try {
        sessionStorage.removeItem(reportDraftKey);
      } catch {
        // ignore
      }
      setDoneState('sent');
    } finally {
      setSubmitting(false);
      setSubmitStep('');
    }
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
      exifValid,
      exifNotice:
        typeof exifValid === 'boolean'
          ? exifValid
            ? EXIF_VALID_TEXT
            : EXIF_INVALID_TEXT
          : undefined,
      narrative: landmark.trim()
        ? `Patokan lapangan: ${landmark.trim()}`
        : 'Usulan titik lokasi kanonik paket.',
      proposedAddress: proposed,
      proposedPrecision: level,
      coordinates: { lat: pinLat, lng: pinLng },
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
    try {
      sessionStorage.removeItem(claimDraftKey);
    } catch {
      // ignore
    }
    setDoneState('claim-sent');
  };

  if (doneState) {
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-14">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <div
            className={`mx-auto mb-4 grid size-14 place-items-center rounded-full ${
              doneState === 'draft' ? 'bg-slate-100 text-slate-700' : 'bg-ok-bg text-ok-text'
            }`}
          >
            {doneState === 'draft' ? (
              <CloudOff className="size-7" aria-hidden="true" />
            ) : (
              <Send className="size-7" aria-hidden="true" />
            )}
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">
            {doneState === 'draft'
              ? 'Draf pengaduan disimpan'
              : doneState === 'claim-sent'
                ? 'Klaim lokasi berhasil dikirim'
                : 'Pengaduan berhasil dikirim'}
          </h1>
          <p className="mt-2 mb-8 text-base leading-relaxed text-slate-600">
            {doneState === 'draft'
              ? 'Draf tersimpan di sesi ini. Anda dapat mengedit, melengkapi foto, atau mengirimnya kapan saja melalui menu Aduan Saya.'
              : 'Kiriman Anda kini berstatus Menunggu Verifikasi dan dapat dilihat oleh warga lain maupun tim verifikasi.'}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => navigate('profil')}
              className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Buka Aduan Saya
            </button>
            <button
              type="button"
              onClick={() => navigate('aduan')}
              className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Lihat Feed Aduan Warga
            </button>
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-slate-100 disabled:cursor-not-allowed';

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate('aduan')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Kembali ke beranda aduan
        </button>
        {editingDraft && (
          <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            Melanjutkan draf #{editingDraft.id}
          </span>
        )}
      </div>

      {/* Pilihan Paket Proyek SPSE */}
      <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-slate-900">
              {formMode === 'lapor' ? 'Buat Pengaduan Kondisi Proyek' : 'Usulkan Titik Lokasi Pasti'}
            </h1>
            <p className="text-sm text-slate-600">
              Setiap laporan atau klaim lokasi wajib terikat pada satu paket proyek SPSE.
            </p>
          </div>

          {/* Switcher Mode Lapor vs Klaim Lokasi */}
          <div className="inline-flex shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => navigate('lapor', p.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                formMode === 'lapor' ? 'bg-brand text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Camera className="size-4" aria-hidden="true" /> Laporan Kondisi
            </button>
            <button
              type="button"
              onClick={() => navigate('klaim', p.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                formMode === 'klaim' ? 'bg-brand text-white' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <MapPinned className="size-4" aria-hidden="true" /> Klaim Lokasi
            </button>
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-slate-50 p-5">
          <div>
            <label
              htmlFor="select-project-package"
              className="mb-1.5 block text-sm font-semibold text-slate-800"
            >
              Pilih paket proyek yang diamati
            </label>
            <select
              id="select-project-package"
              disabled={Boolean(editingDraft) || submitting}
              value={p.id}
              onChange={(e) => onProjectChange(e.target.value)}
              className={inputClass}
            >
              {WARTA_PROJECTS.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.title} · #{proj.spseCode} ({proj.paguCompact})
                </option>
              ))}
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

      {formMode === 'lapor' ? (
        <form onSubmit={handleSubmitReport} className="space-y-8" noValidate>
          {reportErrors.length > 0 && (
            <ul
              role="alert"
              className="list-inside list-disc rounded-2xl border border-bad-border bg-bad-bg p-5 text-sm text-bad-text"
            >
              {reportErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {/* 1. Kategori Temuan */}
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
                    id={`cat-${k}`}
                    type="radio"
                    name="category"
                    disabled={submitting}
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
          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div>
              <label
                htmlFor="report-address"
                className="mb-1.5 block text-base font-bold text-slate-900"
              >
                2. Alamat atau patokan lokasi pengamatan *
              </label>
              <input
                id="report-address"
                type="text"
                disabled={submitting}
                value={proposedAddress}
                onChange={(e) => setProposedAddress(e.target.value)}
                placeholder="Contoh: Sisi selatan Jl. Rorotan IX, dekat gerbang utama proyek"
                className={inputClass}
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
                disabled={submitting}
                maxLength={MAX_NARRATIVE}
                onChange={(e) => setNarrative(e.target.value)}
                rows={4}
                placeholder="Jelaskan kondisi aktual yang Anda temukan: apakah ada papan proyek, aktivitas pekerja, progres fisik, atau kerusakan..."
                className={inputClass}
              />
              <div className="mt-2 flex justify-between text-sm text-slate-600">
                <span>Wajib 20 sampai 500 karakter saat dikirim ke verifikasi</span>
                <span
                  className={`font-semibold tabular-nums ${
                    narrative.trim().length < MIN_NARRATIVE ? 'text-slate-600' : 'text-ok-text'
                  }`}
                >
                  {narrative.length}/{MAX_NARRATIVE} karakter
                </span>
              </div>
            </div>
          </div>

          {/* 4. Foto Bukti & EXIF Check */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-base font-bold text-slate-900">
                  4. Foto bukti lapangan *{' '}
                  <span className="text-sm font-normal text-slate-600">
                    (min. 1, maks. 4 foto, maks. 5MB/foto)
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Server mengekstrak koordinat EXIF secara otomatis untuk memvalidasi jarak dari lokasi proyek.
                </p>
              </div>
              {SAMPLE_DATA && photos.length < 4 && !submitting && (
                <button
                  type="button"
                  onClick={addSamplePhoto}
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
                  {!submitting && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(i)}
                      className="absolute top-2 right-2 rounded-full bg-slate-900/75 p-1.5 text-white transition hover:bg-slate-900"
                      aria-label="Hapus foto"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
              {photos.length < 4 && !submitting && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-700 transition hover:border-brand hover:bg-brand/5">
                  <ImagePlus className="size-6 text-brand" aria-hidden="true" />
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

            {SAMPLE_DATA && photos.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                <ExifCheckBadge valid={exifValid ?? true} />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                  <input
                    id="sim-exif"
                    type="checkbox"
                    disabled={submitting}
                    checked={exifValid === false}
                    onChange={(e) => setExifValid(!e.target.checked)}
                    className="accent-brand"
                  />
                  Simulasikan foto tanpa geotag EXIF
                </label>
              </div>
            )}
          </div>

          {/* 5. Titik Pengamatan */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="mb-3 text-base font-bold text-slate-900">5. Titik koordinat pengamatan</p>
            <MiniPinMap
              value={pin}
              onChange={onPinChange}
              centerLat={p.mapCoordinates?.lat}
              centerLng={p.mapCoordinates?.lng}
            />
          </div>

          {/* Tombol Aksi (Draft-First / Submit) */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              id="report-draft"
              disabled={submitting}
              onClick={handleSaveDraft}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3.5 text-base font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && submitStep.includes('draft') ? (
                <Loader2 className="size-4 animate-spin text-slate-600" />
              ) : (
                <CloudOff className="size-4" aria-hidden="true" />
              )}
              <span>{editingDraft ? 'Simpan Perubahan Draf' : 'Simpan sebagai Draf'}</span>
            </button>
            <button
              type="submit"
              id="report-submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-base font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && !submitStep.includes('draft') ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{submitStep || 'Mengirim...'}</span>
                </>
              ) : (
                <>
                  <Send className="size-4" aria-hidden="true" />
                  <span>Kirim Pengaduan ke Verifikasi</span>
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        /* Form Klaim Lokasi Kanonik */
        <form onSubmit={handleSubmitClaim} className="space-y-8" noValidate>
          {claimErrors.length > 0 && (
            <ul
              role="alert"
              className="list-inside list-disc rounded-2xl border border-bad-border bg-bad-bg p-5 text-sm text-bad-text"
            >
              {claimErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <fieldset className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <legend className="px-1 text-base font-bold text-slate-900">
              1. Tingkat presisi lokasi yang diusulkan *
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {PRECISION_LEVELS.map((l) => (
                <label
                  key={l.v}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-base transition ${
                    level === l.v
                      ? 'border-brand bg-brand/5 font-semibold text-slate-900'
                      : 'border-slate-200 text-slate-800 hover:border-slate-300'
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

          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 sm:p-8">
            <p className="text-base font-bold text-slate-900 sm:col-span-2">
              2. Detail alamat usulan
            </p>
            <div className="sm:col-span-2">
              <label htmlFor="claim-address" className="mb-1.5 block text-sm font-medium text-slate-700">
                Alamat spesifik / nama ruas jalan
              </label>
              <input
                id="claim-address"
                value={claimAddress}
                onChange={(e) => setClaimAddress(e.target.value)}
                placeholder="Contoh: Jl. Pangkalan V No. 12"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="claim-kelurahan" className="mb-1.5 block text-sm font-medium text-slate-700">
                Kelurahan / Desa
              </label>
              <input
                id="claim-kelurahan"
                value={kelurahan}
                onChange={(e) => setKelurahan(e.target.value)}
                placeholder="Contoh: Ciketing Udik"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="claim-kecamatan" className="mb-1.5 block text-sm font-medium text-slate-700">
                Kecamatan *
              </label>
              <input
                id="claim-kecamatan"
                value={kecamatan}
                onChange={(e) => setKecamatan(e.target.value)}
                placeholder="Contoh: Bantargebang"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="claim-landmark" className="mb-1.5 block text-sm font-medium text-slate-700">
                Patokan fisik lapangan
              </label>
              <input
                id="claim-landmark"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Contoh: Seberang pintu air / depan sekolah"
                className={inputClass}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-bold text-slate-900">
                3. Foto papan informasi proyek *{' '}
                <span className="text-sm font-normal text-slate-600">(1 foto)</span>
              </p>
              {SAMPLE_DATA && !claimPhoto && (
                <button
                  type="button"
                  onClick={() => updateClaimPhoto('/photos/tpst-bantargebang.svg')}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-slate-100"
                >
                  + Gunakan Foto Simulasi
                </button>
              )}
            </div>

            {claimPhoto ? (
              <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-slate-200">
                  <img
                    src={claimPhoto}
                    alt="Foto papan proyek"
                    className="h-52 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => updateClaimPhoto(null)}
                    className="absolute top-3 right-3 rounded-lg bg-slate-900/75 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Ganti foto
                  </button>
                </div>
                {SAMPLE_DATA && <ExifCheckBadge valid={exifValid ?? true} />}
              </div>
            ) : (
              <label className="flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-base font-semibold text-slate-700 hover:border-brand hover:bg-brand/5">
                <ImagePlus className="size-6 text-brand" aria-hidden="true" />
                <span>Unggah foto papan proyek</span>
                <input
                  id="claim-photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) updateClaimPhoto(URL.createObjectURL(f));
                  }}
                  className="sr-only"
                />
              </label>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <p className="mb-3 text-base font-bold text-slate-900">4. Titik koordinat usulan</p>
            <MiniPinMap
              value={pin}
              onChange={onPinChange}
              centerLat={p.mapCoordinates?.lat}
              centerLng={p.mapCoordinates?.lng}
              estimate={{ x: 50, y: 50, r: 28 }}
              label="Lingkaran putus-putus: area perkiraan SPSE · Pin biru: titik usulan Anda"
            />
          </div>

          <div className="flex items-start gap-3 rounded-2xl bg-slate-100 p-5 text-sm leading-relaxed text-slate-700">
            <Info className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
            <span>
              Apabila 3 suara verifikasi menyetujui klaim lokasi ini, koordinat usulan Anda akan ditetapkan menjadi lokasi utama proyek dengan penanda <b>Sumber: Warga</b>.
            </span>
          </div>

          <button
            type="submit"
            id="claim-submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-base font-semibold text-white transition hover:bg-brand-dark"
          >
            <Send className="size-4" aria-hidden="true" /> Kirim Usulan Lokasi Proyek
          </button>
        </form>
      )}
    </div>
  );
}
