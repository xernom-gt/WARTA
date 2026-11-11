import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  ExternalLink,
  FilePlus2,
  ImageOff,
  ImagePlus,
  Inbox,
  Map,
  MapPin,
  MapPinCheck,
  RotateCcw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { DATASET_SUMMARY, WARTA_PROJECTS } from '../../data/wartaData';
import type { VerificationItem } from '../../types/warta';
import {
  reportsService,
  reportToVerificationItem,
  apiItemToVerificationItem,
} from '../../services/reports';
import ExifCheckBadge from '../common/ExifCheckBadge';
import StatusBadge from '../common/StatusBadge';

type TypeFilter = 'semua' | 'laporan_kondisi' | 'klaim_lokasi';
type StatusFilter = 'semua' | 'menunggu' | 'terverifikasi' | 'diterima' | 'ditolak';
type SortKey = 'terbaru' | 'dukungan';
type FeedState = 'ready' | 'loading' | 'error';

export default function PublicReportsFeedView() {
  const {
    queue,
    selectedReportId,
    selectReport,
    selectedProjectId,
    navigate,
    vote,
    canVote,
    currentUser,
    setLoginOpen,
    addEvidence,
    deleteEvidence,
  } = useWarta();

  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('semua');
  const [status, setStatus] = useState<StatusFilter>('semua');
  const [projectFilter, setProjectFilter] = useState<string>(selectedProjectId ?? 'semua');
  const [sort, setSort] = useState<SortKey>('terbaru');
  const [feedState, setFeedState] = useState<FeedState>('ready');
  const [apiItems, setApiItems] = useState<VerificationItem[] | null>(null);

  // Form tambah bukti pendukung (POST /reports/{report_id}/evidences)
  const [evDesc, setEvDesc] = useState('');
  const [evPhoto, setEvPhoto] = useState<string | undefined>(undefined);
  const [evError, setEvError] = useState('');

  // Fetch reports from API (specific project reports or global verification queue)
  useEffect(() => {
    const controller = new AbortController();

    const fetchData = async () => {
      try {
        if (projectFilter !== 'semua') {
          const res = await reportsService.listProjectReports(
            projectFilter,
            { status: status !== 'semua' ? status : undefined },
            controller.signal,
          );
          const projectObj = WARTA_PROJECTS.find((p) => p.id === projectFilter) ?? null;
          const mapped = res.data.map((r) => reportToVerificationItem(r, projectObj));
          setApiItems(mapped);
          setFeedState('ready');
        } else {
          const res = await reportsService.listVerificationQueue(
            {
              status: status !== 'semua' ? status : undefined,
              item_type: type !== 'semua' ? type : undefined,
            },
            controller.signal,
          );
          const mapped = res.data.map((it) => apiItemToVerificationItem(it));
          setApiItems(mapped);
          setFeedState('ready');
        }
      } catch {
        if (!controller.signal.aborted) {
          // Fallback gracefully to context queue on offline or API error
          setApiItems(null);
          setFeedState('ready');
        }
      }
    };

    fetchData();

    return () => controller.abort();
  }, [projectFilter, status, type]);

  const activeQueue = useMemo(() => {
    if (apiItems === null) return queue;
    // Satukan laporan lokal (khususnya yang baru diinput warga dengan foto) ke dalam antrean
    const apiIds = new Set(apiItems.map((it) => it.id));
    const localNew = queue.filter((it) => !apiIds.has(it.id));
    const mergedApi = apiItems.map((apiIt) => {
      const localMatch = queue.find((qIt) => qIt.id === apiIt.id);
      if (
        localMatch?.photoUrl &&
        (localMatch.photoUrl.startsWith('data:') || localMatch.photoUrl.startsWith('blob:'))
      ) {
        return {
          ...apiIt,
          photoUrl: localMatch.photoUrl,
          photoUrls: localMatch.photoUrls ?? [localMatch.photoUrl],
        };
      }
      return apiIt;
    });
    return [...localNew, ...mergedApi];
  }, [apiItems, queue]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = activeQueue.filter((it) => {
      const matchTerm =
        !term ||
        [
          it.projectTitle,
          it.spseCode,
          it.authorDisplayName,
          it.narrative,
          it.proposedAddress,
          it.categoryLabel,
        ].some((v) => v.toLowerCase().includes(term));
      const matchType = type === 'semua' || it.itemType === type;
      const matchStatus = status === 'semua' || it.status === status;
      const matchProj = projectFilter === 'semua' || it.projectId === projectFilter;
      return matchTerm && matchType && matchStatus && matchProj;
    });
    if (sort === 'dukungan') return [...filtered].sort((a, b) => b.votesAgree - a.votesAgree);
    return filtered;
  }, [activeQueue, q, type, status, projectFilter, sort]);

  const active = useMemo(
    () => (selectedReportId ? activeQueue.find((it) => it.id === selectedReportId) ?? null : null),
    [activeQueue, selectedReportId],
  );

  const activeProject = useMemo(
    () =>
      projectFilter !== 'semua'
        ? WARTA_PROJECTS.find((p) => p.id === projectFilter) ?? null
        : null,
    [projectFilter],
  );

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectReport(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, selectReport]);

  const resetFilters = () => {
    setQ('');
    setType('semua');
    setStatus('semua');
    setProjectFilter('semua');
    setSort('terbaru');
  };

  const onEvidencePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setEvPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const submitEvidence = (e: FormEvent, item: VerificationItem) => {
    e.preventDefault();
    setEvError('');
    if (!currentUser) {
      setLoginOpen(true);
      return;
    }
    if (evDesc.trim().length < 10) {
      setEvError('Keterangan bukti pendukung minimal 10 karakter.');
      return;
    }
    addEvidence(item.id, evDesc.trim(), evPhoto);
    setEvDesc('');
    setEvPhoto(undefined);
  };

  const waitingCount = activeQueue.filter((it) => it.status === 'menunggu').length;
  const verifiedCount = activeQueue.filter(
    (it) => it.status === 'terverifikasi' || it.status === 'diterima' || it.status === 'selesai',
  ).length;

  const selectClass =
    'rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      {/* Bagian 1: Header Terbuka & Ringkasan Transparansi */}
      <section className="space-y-8 border-b border-slate-200 pb-10">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-semibold tracking-wide text-brand uppercase">
              Transparansi Publik & Partisipasi Warga
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Aduan & Pengamatan Proyek di Sekitar Anda
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              Pantau laporan kondisi fisik infrastruktur yang dikirim warga, lihat bukti foto lapangan, atau kirim laporan baru atas proyek pemerintah di lingkungan Anda.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('lapor', selectedProjectId ?? undefined)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white shadow-xs transition hover:bg-brand-dark"
            >
              <Camera className="size-5" aria-hidden="true" /> + Buat Pengaduan
            </button>
            <button
              type="button"
              onClick={() => navigate('peta')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <Map className="size-5 text-brand" aria-hidden="true" /> Jelajah Proyek & Peta
            </button>
          </div>
        </div>

        {/* Statistik Ringkas Transparansi */}
        <dl className="grid grid-cols-2 gap-6 pt-2 sm:grid-cols-4">
          <div className="border-l-2 border-brand pl-4">
            <dt className="text-sm font-medium text-slate-600">Total Aduan Masuk</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {activeQueue.length} laporan
            </dd>
          </div>
          <div className="border-l-2 border-amber-500 pl-4">
            <dt className="text-sm font-medium text-slate-600">Menunggu Verifikasi</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {waitingCount} laporan
            </dd>
          </div>
          <div className="border-l-2 border-emerald-600 pl-4">
            <dt className="text-sm font-medium text-slate-600">Terverifikasi Warga</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {verifiedCount} laporan
            </dd>
          </div>
          <div className="border-l-2 border-slate-300 pl-4">
            <dt className="text-sm font-medium text-slate-600">Paket Proyek Terpantau</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {DATASET_SUMMARY.uniqueProjects} paket
            </dd>
          </div>
        </dl>
      </section>

      {/* Bagian 2: Pencarian & Filter Cepat */}
      <section aria-label="Pencarian dan filter aduan" className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search
              className="pointer-events-none absolute top-3.5 left-4 size-4 text-slate-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul proyek, lokasi, isi keluhan, atau nama pelapor..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <select
            aria-label="Filter proyek"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className={`${selectClass} md:col-span-3`}
          >
            <option value="semua">Semua proyek ({WARTA_PROJECTS.length})</option>
            {WARTA_PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter jenis kiriman"
            value={type}
            onChange={(e) => setType(e.target.value as TypeFilter)}
            className={`${selectClass} md:col-span-2`}
          >
            <option value="semua">Semua jenis</option>
            <option value="laporan_kondisi">Laporan kondisi</option>
            <option value="klaim_lokasi">Klaim lokasi</option>
          </select>

          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className={`${selectClass} md:col-span-2`}
          >
            <option value="semua">Semua status</option>
            <option value="menunggu">Menunggu verifikasi</option>
            <option value="terverifikasi">Terverifikasi</option>
            <option value="diterima">Lokasi diterima</option>
            <option value="ditolak">Ditolak</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <span>
            Menampilkan <b className="tabular-nums text-slate-900">{list.length}</b> kiriman warga
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSort((s) => (s === 'terbaru' ? 'dukungan' : 'terbaru'))}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Urutan: {sort === 'terbaru' ? 'Terbaru' : 'Dukungan terbanyak'}
            </button>
            {(q || type !== 'semua' || status !== 'semua' || projectFilter !== 'semua') && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Reset filter
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Banner Konteks Filter Proyek */}
      {activeProject && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4 text-sm text-slate-800">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
              <MapPin className="size-5" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-slate-900">
                Menampilkan aduan warga untuk paket: {activeProject.title}
              </p>
              <p className="text-xs text-slate-600">
                Kode SPSE: #{activeProject.spseCode} · Satker: {activeProject.satker}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setProjectFilter('semua')}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Tampilkan Semua Proyek
          </button>
        </div>
      )}

      {/* Bagian 3: Grid Kartu Aduan Bergaya Blog (Foto Utama + Teks Ringkas 2-3 Baris) */}
      <section aria-label="Daftar aduan warga">
        {feedState === 'loading' ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
              >
                <div className="shimmer aspect-16/10 w-full" />
                <div className="space-y-3 p-6">
                  <div className="shimmer h-5 w-1/3 rounded" />
                  <div className="shimmer h-6 w-3/4 rounded" />
                  <div className="shimmer h-4 w-full rounded" />
                  <div className="shimmer h-4 w-2/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : feedState === 'error' ? (
          <div className="rounded-2xl border border-bad-border bg-white px-6 py-14 text-center">
            <AlertCircle className="mx-auto mb-3 size-10 text-bad-border" aria-hidden="true" />
            <h2 className="text-lg font-bold text-slate-900">Gagal memuat daftar aduan warga</h2>
            <p className="mx-auto mt-1.5 mb-6 max-w-md text-base text-slate-600">
              Terjadi kendala saat menghubungi layanan data pengaduan. Silakan muat ulang daftar.
            </p>
            <button
              type="button"
              onClick={() => setFeedState('ready')}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Coba Muat Ulang
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-slate-100">
              <Inbox className="size-7 text-slate-500" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-bold text-slate-900">
              {activeQueue.length === 0
                ? 'Belum ada aduan warga yang dikirim'
                : 'Tidak ada aduan yang cocok dengan filter'}
            </h2>
            <p className="mx-auto mt-2 mb-8 max-w-lg text-base leading-relaxed text-slate-600">
              {activeQueue.length === 0
                ? 'Jadilah warga pertama yang membagikan foto kondisi lapangan atau mengusulkan titik lokasi proyek infrastruktur di sekitar tempat tinggal Anda.'
                : 'Coba ubah kata kunci pencarian atau setel ulang filter status dan proyek untuk melihat laporan lainnya.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {activeQueue.length === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate('lapor')}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white transition hover:bg-brand-dark"
                  >
                    <Camera className="size-5" aria-hidden="true" /> + Buat Aduan Pertama
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('peta')}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 transition hover:bg-slate-50"
                  >
                    Lihat {DATASET_SUMMARY.uniqueProjects} Paket Proyek SPSE
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  Reset Filter Pencarian
                </button>
              )}
            </div>
          </div>
        ) : (
          <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {list.map((it) => (
              <li key={it.id} className="flex">
                <article className="group flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md">
                  <button
                    type="button"
                    onClick={() => selectReport(it.id)}
                    className="flex flex-1 flex-col text-left"
                  >
                    {/* Foto Bukti Lapangan sebagai Fokus Utama Kartu */}
                    <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-100">
                      <ReportPhoto
                        src={it.photoUrl}
                        alt={it.projectTitle}
                        className="size-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      />
                      <div className="absolute top-3 left-3">
                        <StatusBadge status={it.status} size="sm" />
                      </div>
                      {it.distanceFromProject ? (
                        <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs">
                          <MapPin className="size-3 text-brand-light" aria-hidden="true" />
                          <span>{it.distanceFromProject}</span>
                        </div>
                      ) : it.exifValid ? (
                        <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-xs">
                          <MapPinCheck className="size-3 text-emerald-400" aria-hidden="true" />
                          <span>Foto di lokasi</span>
                        </div>
                      ) : null}
                    </div>

                    {/* Isi Kartu */}
                    <div className="flex flex-1 flex-col justify-between space-y-4 p-6">
                      <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                              {it.categoryLabel}
                            </span>
                            {it.spseCode && (
                              <span className="font-mono text-slate-500">#{it.spseCode}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {it.status === 'menunggu' && (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                                <Users className="size-3" aria-hidden="true" />
                                {it.votesAgree}/{it.targetVotes} suara
                              </span>
                            )}
                            <span className="text-slate-500">{it.createdAt}</span>
                          </div>
                        </div>

                        <h2 className="text-lg font-bold leading-snug text-slate-900 group-hover:text-brand">
                          {it.projectTitle}
                        </h2>

                        <p className="line-clamp-3 text-base leading-relaxed text-slate-700">
                          {it.narrative}
                        </p>
                      </div>

                      <div className="space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
                        <p className="flex items-center gap-1.5 truncate">
                          <MapPin className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                          <span className="truncate">{it.proposedAddress}</span>
                        </p>

                        <div className="flex items-center justify-between gap-2">
                          <span>
                            Oleh <b className="font-semibold text-slate-800">{it.authorDisplayName}</b>
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-brand">
                            Baca detail <ArrowRight className="size-4" aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Modal Detail Laporan, Voting Kuorum & Bukti Pendukung */}
      {active && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-xs sm:items-center sm:p-4"
          role="dialog"
          aria-modal
          aria-labelledby="report-detail-title"
        >
          <article className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            {/* Header Modal Detail */}
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur-xs sm:px-8">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={active.status} />
                  <span className="text-sm font-semibold text-brand">{active.categoryLabel}</span>
                </div>
                <h2
                  id="report-detail-title"
                  className="text-xl font-extrabold text-slate-900 sm:text-2xl"
                >
                  {active.projectTitle}
                </h2>
                <p className="text-sm text-slate-600">
                  Dilaporkan oleh <b className="text-slate-900">{active.authorDisplayName}</b> ·{' '}
                  {active.createdAt}
                </p>
              </div>

              <button
                type="button"
                onClick={() => selectReport(null)}
                className="-m-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Tutup detail aduan"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-8 p-6 sm:p-8">
              {/* Foto Bukti Lapangan & Status EXIF */}
              <div className="space-y-3">
                <ReportPhoto
                  src={active.photoUrl}
                  alt={active.projectTitle}
                  className="aspect-16/10 max-h-96 w-full rounded-xl border border-slate-200 bg-slate-100 object-cover"
                />
                {(typeof active.exifValid === 'boolean' || active.distanceFromProject) && (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {typeof active.exifValid === 'boolean' && (
                      <ExifCheckBadge valid={active.exifValid} />
                    )}
                    {active.distanceFromProject && (
                      <span className="text-sm text-slate-600">
                        Jarak pengamatan: <b className="text-slate-900">{active.distanceFromProject}</b>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Narasi Keluhan Penuh & Lokasi */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold tracking-wide text-slate-500 uppercase">
                  Kronologi & Temuan Lapangan
                </h3>
                <p className="text-base leading-relaxed text-slate-900">{active.narrative}</p>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span>
                    <b className="text-slate-900">Lokasi pengamatan:</b> {active.proposedAddress} (
                    {active.coordinates.lat.toFixed(4)}, {active.coordinates.lng.toFixed(4)})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      selectReport(null);
                      navigate('detail', active.projectId);
                    }}
                    className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" /> Lihat Data Kontrak SPSE
                  </button>
                </div>
              </div>

              {/* Dukungan & Verifikasi Warga Sekitar */}
              <div className="space-y-4 border-t border-slate-200 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                    <Users className="size-5 text-brand" aria-hidden="true" /> Verifikasi Warga Sekitar
                  </h3>
                  <span className="text-sm font-semibold tabular-nums text-slate-700">
                    {active.votesAgree} setuju · {active.votesDisagree} tidak setuju (kuorum{' '}
                    {active.targetVotes} suara)
                  </span>
                </div>

                <div className="flex h-2.5 w-full gap-1.5">
                  {Array.from({
                    length: Math.max(active.targetVotes, active.votesAgree + active.votesDisagree, 1),
                  }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-full flex-1 rounded-full transition-colors ${
                        i < active.votesAgree
                          ? 'bg-ok-border'
                          : i < active.votesAgree + active.votesDisagree
                            ? 'bg-bad-border'
                            : 'bg-slate-200'
                      }`}
                    />
                  ))}
                </div>

                {active.status === 'menunggu' && (
                  <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Apakah laporan ini sesuai kondisi lapangan?
                      </p>
                      <p className="text-xs text-slate-600">
                        1 suara per warga. Suara Anda tidak dapat diubah setelah dikirim.
                      </p>
                    </div>

                    {(() => {
                      const check = canVote(active);
                      if (!check.allowed) {
                        return (
                          <p className="text-xs font-medium text-slate-600 sm:max-w-xs sm:text-right">
                            {check.reason}
                          </p>
                        );
                      }
                      return (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => vote(active.id, 'setuju')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-ok-bg px-4 py-2 text-sm font-semibold text-ok-text transition hover:bg-emerald-100"
                          >
                            <ThumbsUp className="size-4" aria-hidden="true" /> Setuju
                          </button>
                          <button
                            type="button"
                            onClick={() => vote(active.id, 'tidak_setuju')}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-bad-bg px-4 py-2 text-sm font-semibold text-bad-text transition hover:bg-rose-100"
                          >
                            <ThumbsDown className="size-4" aria-hidden="true" /> Tidak Sesuai
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Bukti Tambahan dari Warga Lain */}
              <div className="space-y-4 border-t border-slate-200 pt-6">
                <h3 className="text-base font-bold text-slate-900">
                  Bukti Tambahan Warga ({(active.evidences ?? []).length})
                </h3>

                {(active.evidences ?? []).length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    Belum ada bukti tambahan dari warga lain. Anda dapat menambahkan foto atau keterangan saksi mata di bawah.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {(active.evidences ?? []).map((ev) => (
                      <li
                        key={ev.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-start"
                      >
                        {ev.photoUrl && (
                          <img
                            src={ev.photoUrl}
                            alt="Bukti warga"
                            className="h-20 w-24 shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                            <span>
                              Oleh <b className="text-slate-800">{ev.authorDisplayName}</b> · {ev.createdAt}
                            </span>
                            {currentUser === ev.authorDisplayName && (
                              <button
                                type="button"
                                onClick={() => deleteEvidence(active.id, ev.id)}
                                className="inline-flex items-center gap-1 text-bad-text hover:underline"
                              >
                                <Trash2 className="size-3.5" aria-hidden="true" /> Hapus
                              </button>
                            )}
                          </div>
                          <p className="text-sm leading-relaxed text-slate-800">{ev.description}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Form Tambah Bukti */}
                <form
                  onSubmit={(e) => submitEvidence(e, active)}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                >
                  <p className="text-sm font-bold text-slate-900">
                    Punya bukti foto atau kesaksian tambahan?
                  </p>
                  <textarea
                    rows={2}
                    value={evDesc}
                    onChange={(e) => setEvDesc(e.target.value)}
                    placeholder="Tuliskan keterangan kondisi terbaru atau informasi tambahan..."
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        <ImagePlus className="size-4 text-brand" aria-hidden="true" />
                        <span>{evPhoto ? 'Ganti foto' : 'Lampirkan foto'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onEvidencePhoto}
                          className="sr-only"
                        />
                      </label>
                      {evPhoto && (
                        <span className="text-sm font-medium text-ok-text">1 foto terlampir</span>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
                    >
                      <FilePlus2 className="size-4" aria-hidden="true" /> Kirim Bukti Pendukung
                    </button>
                  </div>

                  {evError && <p className="text-sm font-medium text-bad-text">{evError}</p>}
                </form>
              </div>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

function ReportPhoto({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    // Fallback jika domain storage remote warta.id tidak bisa diakses
    if (currentSrc.includes('storage.warta.id') || currentSrc.startsWith('http')) {
      setCurrentSrc('/photos/rusun-rorotan.svg');
    } else {
      setHasError(true);
    }
  };

  if (hasError) {
    return (
      <div className="flex aspect-16/10 w-full items-center justify-center gap-2 bg-slate-100 text-sm text-slate-600">
        <ImageOff className="size-4" aria-hidden="true" /> Foto bukti lapangan
      </div>
    );
  }
  return <img src={currentSrc} alt={alt} onError={handleError} className={className} />;
}
