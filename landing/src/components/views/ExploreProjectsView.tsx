import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Camera,
  Layers,
  MapPinOff,
  MessageSquareText,
  RotateCcw,
  Search,
  SearchX,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { DATASET_SUMMARY, WARTA_PROJECTS } from '../../data/wartaData';
import type { PrecisionLevel, ReportStatus } from '../../types/warta';
import StatusBadge from '../common/StatusBadge';
import JakartaSvgMap from '../map/JakartaSvgMap';
import MapFloatingSheet from '../map/MapFloatingSheet';
import ProjectCard from '../project/ProjectCard';

const CITIES = [
  'Semua',
  'Jakarta Utara',
  'Jakarta Selatan',
  'Jakarta Pusat & Jakarta Barat',
  'Bekasi',
  'Kepulauan Seribu',
];

const CATEGORIES = [
  'Semua',
  'Gedung & Permukiman',
  'Drainase & Pengendali Banjir',
  'Gedung Layanan Sosial',
  'Instalasi Pengolahan Air Sampah',
  'Tanggul Pesisir Pantai',
  'Gedung Sekolah',
  'Jaringan Perpipaan Air Limbah',
  'Ornamen & Fasilitas Wilayah',
];

const STATUSES: { value: 'Semua' | ReportStatus; label: string }[] = [
  { value: 'Semua', label: 'Semua status' },
  { value: 'menunggu', label: 'Menunggu verifikasi' },
  { value: 'terverifikasi', label: 'Terverifikasi warga' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'selesai', label: 'Selesai' },
];

const YEARS = ['Semua', '2022', '2023', '2024', '2025', '2026', '2027'];

const PRECISIONS: { value: 'Semua' | PrecisionLevel; label: string }[] = [
  { value: 'Semua', label: 'Semua tingkat lokasi' },
  { value: 'kabupaten/kota', label: 'Tingkat Kabupaten/Kota' },
  { value: 'kecamatan', label: 'Tingkat Kecamatan' },
  { value: 'desa/kelurahan', label: 'Tingkat Desa/Kelurahan' },
  { value: 'alamat/ruas', label: 'Alamat / Ruas Jalan' },
  { value: 'titik', label: 'Titik Koordinat Pasti' },
];

export default function ExploreProjectsView() {
  const {
    mapCondition,
    setMapCondition,
    selectedProjectId,
    selectProject,
    navigate,
    compactRupiah,
    toggleRupiah,
    queue,
  } = useWarta();

  const [q, setQ] = useState('');
  const [city, setCity] = useState('Semua');
  const [category, setCategory] = useState('Semua');
  const [status, setStatus] = useState<'Semua' | ReportStatus>('Semua');
  const [year, setYear] = useState('Semua');
  const [precision, setPrecision] = useState<'Semua' | PrecisionLevel>('Semua');
  const [onlyRetender, setOnlyRetender] = useState(false);

  const resetFilters = () => {
    setQ('');
    setCity('Semua');
    setCategory('Semua');
    setStatus('Semua');
    setYear('Semua');
    setPrecision('Semua');
    setOnlyRetender(false);
    if (mapCondition === 'filter-empty') setMapCondition('normal');
  };

  const list = useMemo(() => {
    if (mapCondition === 'filter-empty') return [];
    const term = q.trim().toLowerCase();
    return WARTA_PROJECTS.filter((p) => {
      const matchQ =
        !term ||
        [p.title, p.spseCode, p.satker, p.locationDesc, p.city].some((v) =>
          v.toLowerCase().includes(term),
        );
      return (
        matchQ &&
        (city === 'Semua' || p.city === city) &&
        (category === 'Semua' || p.category === category) &&
        (status === 'Semua' || p.status === status) &&
        (year === 'Semua' || p.years.includes(year)) &&
        (precision === 'Semua' || p.precisionLevel === precision) &&
        (!onlyRetender || p.isRetender)
      );
    });
  }, [q, city, category, status, year, precision, onlyRetender, mapCondition]);

  const selected = list.find((p) => p.id === selectedProjectId) ?? null;
  const gpsDenied = mapCondition === 'gps-denied';
  const tileError = mapCondition === 'tile-error';
  const loading = mapCondition === 'loading';
  const latestReports = queue.slice(0, 3);

  const selectClass =
    'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Bagian 1: Pengantar Editorial & Pintasan Aksi Warga */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Pantau proyek infrastruktur di depan rumah Anda
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              Telusuri paket pengadaan SPSE/INAPROC, baca aduan kondisi fisik yang sudah dikirim warga sekitar, atau kirim laporan baru beserta foto lapangan dan titik lokasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('lapor')}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <Camera className="size-4" /> Buat Pengaduan Baru
            </button>
            <button
              type="button"
              onClick={() => navigate('aduan')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              <MessageSquareText className="size-4 text-brand" /> Lihat Aduan Warga ({queue.length})
            </button>
          </div>
        </div>

        {/* Ringkasan Fakta Dataset SPSE */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-4">
          <div>
            <p className="text-xl font-extrabold tabular-nums text-slate-900">
              {DATASET_SUMMARY.uniqueProjects} paket
            </p>
            <p className="text-xs text-slate-500">
              Disatukan dari {DATASET_SUMMARY.totalRawPackages} baris tender SPSE
            </p>
          </div>
          <div>
            <p className="text-xl font-extrabold tabular-nums text-slate-900">
              {DATASET_SUMMARY.precisionBreakdown.kabupatenKota} paket
            </p>
            <p className="text-xs text-slate-500">
              Lokasi di SPSE baru tercatat tingkat kota
            </p>
          </div>
          <div>
            <p className="text-xl font-extrabold tabular-nums text-slate-900">
              {DATASET_SUMMARY.missingContractCount} paket
            </p>
            <p className="text-xs text-slate-500">
              Nilai kontrak belum tersedia di sumber publik
            </p>
          </div>
          <div>
            <p className="text-xl font-extrabold tabular-nums text-slate-900">
              {queue.length} kiriman
            </p>
            <p className="text-xs text-slate-500">
              Aduan kondisi & klaim lokasi dari warga
            </p>
          </div>
        </div>
      </section>

      {/* Bagian 2: Cuplikan Aduan Warga Terbaru (Agar Pengadu Langsung Bisa Melihat Aduan Lain) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">Aduan & pengamatan warga terbaru</h2>
            <p className="text-xs text-slate-500">
              Klik salah satu aduan untuk melihat bukti foto, status EXIF GPS, atau menambahkan bukti pendukung.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('aduan')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
          >
            Lihat semua aduan warga ({queue.length}) <ArrowRight className="size-3.5" />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {latestReports.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate('aduan', item.projectId, item.id)}
              className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-left transition hover:border-slate-300 hover:bg-white"
            >
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-brand">
                    {item.categoryLabel}
                  </span>
                  <StatusBadge status={item.status} size="sm" />
                </div>
                <p className="text-sm font-bold text-slate-900 group-hover:text-brand">
                  {item.projectTitle}
                </p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                  {item.narrative}
                </p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2 text-xs text-slate-500">
                <span>Oleh {item.authorDisplayName}</span>
                <span className="font-medium tabular-nums text-slate-700">
                  {item.votesAgree}/{item.targetVotes} suara · {(item.evidences ?? []).length} bukti
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Bagian 3: Katalog Proyek & Peta Interaktif */}
      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Kolom Katalog — 58% */}
        <section className="space-y-4 lg:w-[58%]" aria-label="Katalog paket proyek">
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute top-3 left-3.5 size-4 text-slate-400" />
              <input
                id="search-input"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama proyek, kode tender SPSE, satker, atau kelurahan…"
                className="w-full rounded-xl border border-slate-300 py-2.5 pr-3.5 pl-10 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              <select
                id="filter-city"
                aria-label="Filter kota"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={selectClass}
              >
                {CITIES.map((c) => (
                  <option key={c} value={c}>
                    {c === 'Semua' ? 'Semua kota/kabupaten' : c}
                  </option>
                ))}
              </select>

              <select
                id="filter-category"
                aria-label="Filter kategori"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c === 'Semua' ? 'Semua kategori proyek' : c}
                  </option>
                ))}
              </select>

              <select
                id="filter-status"
                aria-label="Filter status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Semua' | ReportStatus)}
                className={selectClass}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <select
                id="filter-year"
                aria-label="Filter tahun"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={selectClass}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y === 'Semua' ? 'Semua tahun anggaran' : `Tahun ${y}`}
                  </option>
                ))}
              </select>

              <select
                id="filter-precision"
                aria-label="Filter presisi"
                value={precision}
                onChange={(e) => setPrecision(e.target.value as 'Semua' | PrecisionLevel)}
                className={selectClass}
              >
                {PRECISIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>

              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={onlyRetender}
                  onChange={(e) => setOnlyRetender(e.target.checked)}
                  className="accent-brand"
                />
                <span>Hanya tender ulang</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
              <span>
                Menampilkan <b className="tabular-nums text-slate-900">{list.length}</b> dari{' '}
                {WARTA_PROJECTS.length} paket contoh ({DATASET_SUMMARY.uniqueProjects} di dataset penuh)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="reset-filters"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                >
                  <RotateCcw className="size-3.5" /> Reset filter
                </button>
                <button
                  type="button"
                  id="toggle-rupiah"
                  onClick={toggleRupiah}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Anggaran: {compactRupiah ? 'Ringkas' : 'Lengkap'}
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="shimmer h-4 w-24 rounded" />
                  <div className="shimmer h-5 w-3/4 rounded" />
                  <div className="shimmer h-3 w-1/3 rounded" />
                  <div className="shimmer h-7 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <div className="mb-3 grid size-14 place-items-center rounded-full bg-slate-100">
                <SearchX className="size-7 text-slate-500" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Tidak ada paket proyek yang cocok</h2>
              <p className="mt-1 mb-4 max-w-sm text-sm text-slate-500">
                Coba ubah kata kunci pencarian atau setel ulang filter kota, kategori, maupun tingkat presisi lokasi.
              </p>
              <button
                type="button"
                id="empty-reset"
                onClick={resetFilters}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid gap-3.5 sm:grid-cols-2">
              {list.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  compact={compactRupiah}
                  showDistance={!gpsDenied}
                  selected={p.id === selectedProjectId}
                  onSelect={() => selectProject(p.id)}
                  onOpen={() => navigate('detail', p.id)}
                  onReport={() => navigate('lapor', p.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Kolom Peta — 42% */}
        <section className="lg:w-[42%]" aria-label="Peta proyek SPSE">
          <div className="relative h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-20 lg:h-[calc(100vh-7rem)]">
            {tileError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
                <MapPinOff className="size-10 text-bad-border" />
                <h2 className="text-base font-bold text-slate-900">Peta gagal dimuat</h2>
                <p className="max-w-xs text-sm text-slate-500">
                  Koneksi ke layanan peta terputus. Anda tetap dapat memilih paket proyek dari daftar di samping.
                </p>
                <button
                  type="button"
                  id="map-retry"
                  onClick={() => setMapCondition('normal')}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Muat ulang peta
                </button>
              </div>
            ) : (
              <>
                <JakartaSvgMap
                  projects={list}
                  selectedId={selectedProjectId}
                  onSelect={selectProject}
                  gpsDenied={gpsDenied}
                  className={loading ? 'animate-pulse opacity-60' : ''}
                />
                <div className="absolute top-3 right-3 space-y-1 rounded-xl border border-slate-200 bg-white/95 p-2.5 text-xs text-slate-700 shadow-xs backdrop-blur-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <Layers className="size-3.5 text-brand" /> Keterangan pin
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <svg width="14" height="14">
                      <circle
                        cx="7"
                        cy="7"
                        r="6"
                        fill="none"
                        stroke="#1f3b57"
                        strokeDasharray="3 2"
                        strokeWidth="1.5"
                      />
                    </svg>
                    Area perkiraan (tingkat kota/kelurahan)
                  </p>
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-600">
                    <svg width="14" height="14">
                      <path
                        d="M7 13 C3 8 2 6 2 5 A5 5 0 1 1 12 5 C12 6 11 8 7 13Z"
                        fill="#1f3b57"
                      />
                    </svg>
                    Titik lokasi terverifikasi
                  </p>
                </div>
                {selected && (
                  <MapFloatingSheet
                    project={selected}
                    compact={compactRupiah}
                    showDistance={!gpsDenied}
                    onOpen={() => navigate('detail', selected.id)}
                    onClose={() => selectProject(null)}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
