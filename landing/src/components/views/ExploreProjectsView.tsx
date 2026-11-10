import { useMemo, useState } from 'react';
import { Camera, MessageSquareText } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { DATASET_SUMMARY, WARTA_PROJECTS } from '../../data/wartaData';
import type { PrecisionLevel, ReportStatus } from '../../types/warta';
import FilterPanel from '../explore/FilterPanel';
import ProjectCatalog from '../explore/ProjectCatalog';
import MapPanel from '../explore/MapPanel';

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

  const handleResetFilters = () => {
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

  const gpsDenied = mapCondition === 'gps-denied';
  const tileError = mapCondition === 'tile-error';
  const loading = mapCondition === 'loading';

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
      {/* Header */}
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
            {DATASET_SUMMARY.precisionBreakdown.kabupatenKota} paket yang lokasinya baru tercatat
            tingkat kota di SPSE).
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
            <MessageSquareText className="size-5 text-brand" aria-hidden="true" /> Feed Aduan (
            {queue.length})
          </button>
        </div>
      </section>

      {/* Filters */}
      <FilterPanel
        query={q}
        onQueryChange={setQ}
        city={city}
        onCityChange={setCity}
        category={category}
        onCategoryChange={setCategory}
        status={status}
        onStatusChange={setStatus}
        year={year}
        onYearChange={setYear}
        precision={precision}
        onPrecisionChange={setPrecision}
        onlyRetender={onlyRetender}
        onRetenderChange={setOnlyRetender}
        onReset={handleResetFilters}
        resultsCount={list.length}
        totalCount={WARTA_PROJECTS.length}
      />

      {/* Layout: Catalog (58%) + Map (42%) */}
      <div className="flex flex-col gap-8 lg:flex-row">
        <section className="space-y-6 lg:w-[58%]" aria-label="Katalog paket proyek">
          <div className="flex items-center justify-between">
            <div />
            <button
              type="button"
              id="toggle-rupiah"
              onClick={toggleRupiah}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100"
            >
              Anggaran: {compactRupiah ? 'Ringkas' : 'Lengkap'}
            </button>
          </div>
          <ProjectCatalog
            projects={list}
            selectedId={selectedProjectId}
            onSelect={selectProject}
            onOpen={(id) => navigate('detail', id)}
            onReport={(id) => navigate('lapor', id)}
            compact={compactRupiah}
            showDistance={!gpsDenied}
            loading={loading}
            onReset={handleResetFilters}
          />
        </section>

        <section className="lg:w-[42%]" aria-label="Peta proyek SPSE">
          <MapPanel
            projects={list}
            selectedId={selectedProjectId}
            onSelect={selectProject}
            onOpen={(id) => navigate('detail', id)}
            compact={compactRupiah}
            showDistance={!gpsDenied}
            gpsDenied={gpsDenied}
            tileError={tileError}
            loading={loading}
            onRetry={() => setMapCondition('normal')}
          />
        </section>
      </div>
    </div>
  );
}
