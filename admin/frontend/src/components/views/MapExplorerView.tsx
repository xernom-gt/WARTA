import { useMemo, useState } from 'react';
import { AlertTriangle, Layers, MapPinOff, Search, SearchX, SlidersHorizontal } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { WARTA_PROJECTS } from '../../data/wartaData';
import type { PrecisionLevel, ReportStatus } from '../../types/warta';
import JakartaSvgMap from '../map/JakartaSvgMap';
import MapFloatingSheet from '../map/MapFloatingSheet';
import ProjectCard from '../project/ProjectCard';

const YEARS = ['2022', '2023', '2024', '2025', '2026', '2027'];
const CATEGORIES = [...new Set(WARTA_PROJECTS.map((p) => p.category))];
const PRECISIONS: PrecisionLevel[] = ['kabupaten/kota', 'kecamatan', 'desa/kelurahan', 'alamat/ruas', 'titik'];
const STATUSES: ReportStatus[] = ['menunggu', 'terverifikasi', 'ditolak', 'selesai'];

export default function MapExplorerView() {
  const { mapCondition, setMapCondition, compactRupiah, toggleRupiah, selectedProjectId, selectProject, navigate } = useWarta();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [year, setYear] = useState('');
  const [precision, setPrecision] = useState('');
  const [hasReports, setHasReports] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return WARTA_PROJECTS.filter(
      (p) =>
        (!s || [p.title, p.spseCode, p.locationDesc, p.city, ...p.failedTenders.map((t) => t.code)].some((v) => v.toLowerCase().includes(s))) &&
        (!category || p.category === category) &&
        (!status || p.status === status) &&
        (!year || p.years.includes(year)) &&
        (!precision || p.precisionLevel === precision) &&
        (!hasReports || p.reportsCount > 0),
    );
  }, [q, category, status, year, precision, hasReports]);

  const forcedEmpty = mapCondition === 'filter-empty';
  const list = forcedEmpty ? [] : filtered;
  const gpsDenied = mapCondition === 'gps-denied';
  const loading = mapCondition === 'loading';
  const tileError = mapCondition === 'tile-error';
  const selected = list.find((p) => p.id === selectedProjectId) ?? null;
  const activeFilters = [category, status, year, precision].filter(Boolean).length + (hasReports ? 1 : 0);

  const resetFilters = () => {
    setQ(''); setCategory(''); setStatus(''); setYear(''); setPrecision(''); setHasReports(false);
    if (forcedEmpty) setMapCondition('normal');
  };

  const sel = 'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-action-border';

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col-reverse gap-4 p-4 lg:flex-row">
      {/* Katalog — 58% */}
      <section className="flex min-w-0 flex-col gap-3 lg:w-[58%]" aria-label="Katalog paket">
        {gpsDenied && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-wait-border bg-wait-bg p-3 text-sm text-wait-text">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p><b>Izin lokasi ditolak.</b> Peta diarahkan ke pusat Jakarta (Monas) dan jarak ke proyek disembunyikan. Aktifkan izin lokasi di browser untuk melihat proyek terdekat.</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:ring-2 focus-within:ring-action-border">
              <Search className="size-4 text-slate-400" />
              <input id="search-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama paket, kode tender, atau lokasi…" className="w-full py-2 text-sm outline-none" />
            </label>
            <button id="toggle-filters" onClick={() => setShowFilters((v) => !v)} className="relative flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50" aria-expanded={showFilters}>
              <SlidersHorizontal className="size-4" /><span className="hidden sm:inline">Filter</span>
              {activeFilters > 0 && <span className="grid size-5 place-items-center rounded-full bg-brand text-[11px] text-white">{activeFilters}</span>}
            </button>
          </div>

          {showFilters && (
            <div className="mt-3 grid animate-pop grid-cols-2 gap-2 sm:grid-cols-4">
              <select id="filter-category" value={category} onChange={(e) => setCategory(e.target.value)} className={sel} aria-label="Kategori">
                <option value="">Semua kategori</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <select id="filter-status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel} aria-label="Status">
                <option value="">Semua status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
              </select>
              <select id="filter-year" value={year} onChange={(e) => setYear(e.target.value)} className={sel} aria-label="Tahun anggaran">
                <option value="">Semua tahun</option>
                {YEARS.map((y) => <option key={y}>{y}</option>)}
              </select>
              <select id="filter-precision" value={precision} onChange={(e) => setPrecision(e.target.value)} className={sel} aria-label="Presisi lokasi">
                <option value="">Semua presisi</option>
                {PRECISIONS.map((p) => <option key={p}>{p}</option>)}
              </select>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input id="filter-has-reports" type="checkbox" checked={hasReports} onChange={(e) => setHasReports(e.target.checked)} className="size-4 accent-brand" />
                Punya Laporan Warga
              </label>
              <button id="filter-reset" onClick={resetFilters} className="col-span-2 text-right text-sm font-semibold text-action-border hover:underline sm:col-span-2">Reset filter</button>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>{loading ? 'Memuat paket…' : `${list.length} paket ditampilkan`}</span>
            <button id="toggle-rupiah" onClick={toggleRupiah} className="rounded-full border border-slate-300 px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-50">
              Format: {compactRupiah ? 'Ringkas' : 'Lengkap'}
            </button>
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
                <div className="shimmer h-3 w-full rounded" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <div className="mb-4 grid size-20 place-items-center rounded-full bg-action-bg">
              <SearchX className="size-10 text-action-border" />
            </div>
            <h2 className="text-lg font-bold">Tidak ada paket yang cocok</h2>
            <p className="mb-4 max-w-sm text-sm text-slate-500">Coba ubah kata kunci atau longgarkan filter kategori, status, tahun, maupun presisi lokasi.</p>
            <button id="empty-reset" onClick={resetFilters} className="rounded-xl bg-brand px-5 py-2 font-semibold text-white hover:bg-brand-dark">Reset Filter</button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {list.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                compact={compactRupiah}
                showDistance={!gpsDenied}
                selected={p.id === selectedProjectId}
                onSelect={() => selectProject(p.id)}
                onOpen={() => navigate('detail', p.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Peta — 42% */}
      <section className="lg:w-[42%]" aria-label="Peta proyek">
        <div className="relative h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-36 lg:h-[calc(100vh-11rem)]">
          {tileError ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
              <MapPinOff className="size-12 text-bad-border" />
              <h2 className="font-bold">Peta gagal dimuat</h2>
              <p className="max-w-xs text-sm text-slate-500">Koneksi ke layanan peta terputus. Gunakan mode daftar di samping untuk tetap menelusuri paket.</p>
              <div className="w-full max-w-xs overflow-hidden rounded-lg border border-slate-200 bg-white text-left text-xs">
                {WARTA_PROJECTS.slice(0, 4).map((p) => (
                  <button key={p.id} onClick={() => navigate('detail', p.id)} className="flex w-full justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50">
                    <span className="truncate">{p.title}</span><span className="shrink-0 font-semibold">{p.paguCompact}</span>
                  </button>
                ))}
              </div>
              <button id="map-retry" onClick={() => setMapCondition('normal')} className="rounded-lg border border-slate-300 px-4 py-1.5 text-sm font-semibold hover:bg-white">Coba lagi</button>
            </div>
          ) : (
            <>
              <JakartaSvgMap projects={list} selectedId={selectedProjectId} onSelect={selectProject} gpsDenied={gpsDenied} className={loading ? 'animate-pulse opacity-60' : ''} />
              <div className="absolute right-3 top-3 space-y-1 rounded-xl bg-white/90 p-2.5 text-[11px] shadow backdrop-blur">
                <p className="flex items-center gap-1 font-bold"><Layers className="size-3" />Legenda</p>
                <p className="flex items-center gap-1.5"><svg width="14" height="14"><circle cx="7" cy="7" r="6" fill="none" stroke="#1f3b57" strokeDasharray="3 2" strokeWidth="1.5" /></svg>Area Perkiraan (Tingkat Kota/Kelurahan)</p>
                <p className="flex items-center gap-1.5"><svg width="14" height="14"><path d="M7 13 C3 8 2 6 2 5 A5 5 0 1 1 12 5 C12 6 11 8 7 13Z" fill="#1f3b57" /></svg>Pin Titik Pasti</p>
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
  );
}
