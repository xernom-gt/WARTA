import { useEffect, useMemo, useState } from 'react';
import {
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
import type { PrecisionLevel, ProjectPackage, ReportStatus } from '../../types/warta';
import JakartaSvgMap from '../map/JakartaSvgMap';
import MapFloatingSheet from '../map/MapFloatingSheet';
import ProjectCard from '../project/ProjectCard';
import {
  projectsService,
  toProjectPackage,
  type ProjectQueryParams,
} from '../../services/projects';

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

const PAGU_RANGES = [
  { value: 'Semua', label: 'Semua pagu anggaran' },
  { value: 'under-10b', label: '< Rp10 Miliar' },
  { value: '10b-50b', label: 'Rp10 M – Rp50 Miliar' },
  { value: 'over-50b', label: '> Rp50 Miliar' },
];

const SORTS = [
  { value: '-created_at', label: 'Terbaru' },
  { value: '-pagu_amount', label: 'Pagu Tertinggi' },
  { value: 'pagu_amount', label: 'Pagu Terendah' },
  { value: 'title', label: 'Nama Paket (A-Z)' },
];

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
  const [paguRange, setPaguRange] = useState('Semua');
  const [sort, setSort] = useState('-created_at');
  const [onlyRetender, setOnlyRetender] = useState(false);

  // API State
  const [apiProjects, setApiProjects] = useState<ProjectPackage[] | null>(null);
  const [totalProjects, setTotalProjects] = useState<number>(WARTA_PROJECTS.length);
  const [loadingApi, setLoadingApi] = useState<boolean>(false);

  const resetFilters = () => {
    setQ('');
    setCity('Semua');
    setCategory('Semua');
    setStatus('Semua');
    setYear('Semua');
    setPrecision('Semua');
    setPaguRange('Semua');
    setSort('-created_at');
    setOnlyRetender(false);
    if (mapCondition === 'filter-empty') setMapCondition('normal');
  };

  const matchesPagu = (paguRaw: number, range: string) => {
    if (range === 'under-10b') return paguRaw < 10_000_000_000;
    if (range === '10b-50b') return paguRaw >= 10_000_000_000 && paguRaw <= 50_000_000_000;
    if (range === 'over-50b') return paguRaw > 50_000_000_000;
    return true;
  };

  // Fetch live API data with debounce and cancellation
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params: ProjectQueryParams = {};
      const cleanQ = q.trim();
      if (cleanQ) params.q = cleanQ;
      if (city !== 'Semua') params.city = city;
      if (category !== 'Semua') params.category = category;
      if (status !== 'Semua') params.status = status;
      if (year !== 'Semua') {
        const parsedYear = parseInt(year, 10);
        if (!Number.isNaN(parsedYear)) params.year = parsedYear;
      }
      if (precision !== 'Semua') params.precision_level = precision;
      if (sort) params.sort = sort;
      if (onlyRetender) params.is_retender = true;

      setLoadingApi(true);
      try {
        const [projectRes, pinsRes] = await Promise.allSettled([
          projectsService.listProjects(params, controller.signal),
          projectsService.getProjectMapPins(
            {
              bbox: '106.6,-6.4,107.0,-6.1',
              status: status !== 'Semua' ? status : undefined,
              category: category !== 'Semua' ? category : undefined,
            },
            controller.signal,
          ),
        ]);

        if (projectRes.status === 'fulfilled') {
          const pins = pinsRes.status === 'fulfilled' ? pinsRes.value : [];
          const pinCoordsMap = new Map<string, { lat?: number | null; lng?: number | null }>();
          for (const pin of pins) {
            pinCoordsMap.set(pin.id, { lat: pin.latitude, lng: pin.longitude });
          }

          const mapped = projectRes.value.data.map((p) =>
            toProjectPackage(p, pinCoordsMap.get(p.id)),
          );
          // Jika DB backend belum memiliki data proyek (tabel kosong), gunakan fallback sample data agar peta tidak kosong
          setApiProjects(mapped.length > 0 ? mapped : null);
          setTotalProjects(mapped.length > 0 ? projectRes.value.meta.total : WARTA_PROJECTS.length);
        } else {
          // If API fails or is offline, fallback to null (activates mock fallback)
          setApiProjects(null);
        }
      } catch {
        setApiProjects(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingApi(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, city, category, status, year, precision, sort, onlyRetender]);

  // Local fallback filter if API is not yet active
  const fallbackList = useMemo(() => {
    if (mapCondition === 'filter-empty') return [];
    const term = q.trim().toLowerCase();
    const filtered = WARTA_PROJECTS.filter((p) => {
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
        (!onlyRetender || p.isRetender) &&
        matchesPagu(p.paguRaw, paguRange)
      );
    });
    if (sort === '-pagu_amount') return [...filtered].sort((a, b) => b.paguRaw - a.paguRaw);
    if (sort === 'pagu_amount') return [...filtered].sort((a, b) => a.paguRaw - b.paguRaw);
    if (sort === 'title') return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    return filtered;
  }, [q, city, category, status, year, precision, onlyRetender, paguRange, sort, mapCondition]);

  const list = useMemo(() => {
    if (mapCondition === 'filter-empty') return [];
    const base = apiProjects !== null ? apiProjects : fallbackList;
    if (paguRange === 'Semua') return base;
    return base.filter((p) => matchesPagu(p.paguRaw, paguRange));
  }, [apiProjects, fallbackList, mapCondition, paguRange]);

  const selected = list.find((p) => p.id === selectedProjectId) ?? null;
  const gpsDenied = mapCondition === 'gps-denied';
  const tileError = mapCondition === 'tile-error';
  const loading = mapCondition === 'loading' || loadingApi;

  const selectClass =
    'rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      {/* Header Halaman Terbuka */}
      <section className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end">
        <div className="max-w-2xl space-y-2.5">
          <p className="text-sm font-semibold tracking-wide text-brand uppercase">
            Katalog Data Terbuka SPSE / INAPROC
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Jelajah Paket Proyek & Peta Sebaran
          </h1>
          <p className="text-base leading-relaxed text-slate-600">
            Menampilkan {DATASET_SUMMARY.uniqueProjects} paket proyek unik (termasuk{' '}
            {DATASET_SUMMARY.precisionBreakdown.kabupatenKota} paket yang lokasinya baru tercatat tingkat kota di SPSE).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('lapor')}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white transition hover:bg-brand-dark"
          >
            <Camera className="size-5" aria-hidden="true" /> + Buat Pengaduan
          </button>
          <button
            type="button"
            onClick={() => navigate('aduan')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 transition hover:bg-slate-50"
          >
            <MessageSquareText className="size-5 text-brand" aria-hidden="true" /> Feed Aduan ({queue.length})
          </button>
        </div>
      </section>

      {/* Filter Katalog */}
      <section aria-label="Filter paket proyek" className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search
              className="pointer-events-none absolute top-3.5 left-4 size-4 text-slate-500"
              aria-hidden="true"
            />
            <input
              id="search-input"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama proyek, kode tender SPSE, satker, atau kelurahan..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <select
            id="filter-city"
            aria-label="Filter kota"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className={`${selectClass} md:col-span-3`}
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
            className={`${selectClass} md:col-span-2`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c === 'Semua' ? 'Semua kategori' : c}
              </option>
            ))}
          </select>

          <select
            id="filter-status"
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value as 'Semua' | ReportStatus)}
            className={`${selectClass} md:col-span-2`}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <div className="flex flex-wrap items-center gap-3">
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

            <select
              id="filter-pagu"
              aria-label="Filter pagu anggaran"
              value={paguRange}
              onChange={(e) => setPaguRange(e.target.value)}
              className={selectClass}
            >
              {PAGU_RANGES.map((pr) => (
                <option key={pr.value} value={pr.value}>
                  {pr.label}
                </option>
              ))}
            </select>

            <select
              id="filter-sort"
              aria-label="Urutkan proyek"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className={selectClass}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  Urut: {s.label}
                </option>
              ))}
            </select>

            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
              <input
                type="checkbox"
                checked={onlyRetender}
                onChange={(e) => setOnlyRetender(e.target.checked)}
                className="accent-brand"
              />
              <span>Hanya tender ulang</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span>
              Menampilkan <b className="tabular-nums text-slate-900">{list.length}</b> dari{' '}
              {apiProjects !== null ? totalProjects : WARTA_PROJECTS.length} paket
            </span>
            <button
              type="button"
              id="reset-filters"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Reset
            </button>
            <button
              type="button"
              id="toggle-rupiah"
              onClick={toggleRupiah}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Anggaran: {compactRupiah ? 'Ringkas' : 'Lengkap'}
            </button>
          </div>
        </div>
      </section>

      {/* Katalog Proyek (58%) & Peta Interaktif (42%) */}
      <div className="flex flex-col gap-8 lg:flex-row">
        <section className="space-y-6 lg:w-[58%]" aria-label="Katalog paket proyek">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
                  <div className="shimmer h-5 w-24 rounded" />
                  <div className="shimmer h-6 w-3/4 rounded" />
                  <div className="shimmer h-4 w-1/3 rounded" />
                  <div className="shimmer h-8 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : list.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <div className="mb-4 grid size-14 place-items-center rounded-full bg-slate-100">
                <SearchX className="size-7 text-slate-500" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Tidak ada paket proyek yang cocok</h2>
              <p className="mt-1.5 mb-6 max-w-sm text-base text-slate-600">
                Coba ubah kata kunci pencarian atau setel ulang filter kota, kategori, maupun tingkat presisi lokasi.
              </p>
              <button
                type="button"
                id="empty-reset"
                onClick={resetFilters}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
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

        {/* Kolom Peta */}
        <section className="lg:w-[42%]" aria-label="Peta proyek SPSE">
          <div className="relative h-[440px] overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
            {tileError ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
                <MapPinOff className="size-10 text-bad-border" aria-hidden="true" />
                <h2 className="text-lg font-bold text-slate-900">Peta gagal dimuat</h2>
                <p className="max-w-xs text-base text-slate-600">
                  Koneksi ke layanan peta terputus. Anda tetap dapat memilih paket proyek dari daftar di samping.
                </p>
                <button
                  type="button"
                  id="map-retry"
                  onClick={() => setMapCondition('normal')}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                <div className="absolute top-3 right-3 space-y-1.5 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-xs backdrop-blur-xs">
                  <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <Layers className="size-3.5 text-brand" aria-hidden="true" /> Keterangan pin
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-600">
                    <svg width="14" height="14" aria-hidden="true">
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
                  <p className="flex items-center gap-1.5 text-xs text-slate-600">
                    <svg width="14" height="14" aria-hidden="true">
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
