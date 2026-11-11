import { RotateCcw, Search } from 'lucide-react';
import type { PrecisionLevel, ReportStatus } from '../../types/warta';
import { CITIES, CATEGORIES, STATUSES, YEARS, PRECISIONS } from '../../constants/filters';
import { SELECT_CLASS } from '../../constants/formConfig';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  city: string;
  onCityChange: (c: string) => void;
  category: string;
  onCategoryChange: (c: string) => void;
  status: 'Semua' | ReportStatus;
  onStatusChange: (s: 'Semua' | ReportStatus) => void;
  year: string;
  onYearChange: (y: string) => void;
  precision: 'Semua' | PrecisionLevel;
  onPrecisionChange: (p: 'Semua' | PrecisionLevel) => void;
  onlyRetender: boolean;
  onRetenderChange: (v: boolean) => void;
  onReset: () => void;
  resultsCount: number;
  totalCount: number;
}

export default function FilterPanel({
  query,
  onQueryChange,
  city,
  onCityChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  year,
  onYearChange,
  precision,
  onPrecisionChange,
  onlyRetender,
  onRetenderChange,
  onReset,
  resultsCount,
  totalCount,
}: Props) {
  return (
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
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Cari nama proyek, kode tender SPSE, satker, atau kelurahan..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pr-4 pl-11 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </div>

        <select
          id="filter-city"
          aria-label="Filter kota"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
          className={`${SELECT_CLASS} md:col-span-3`}
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
          onChange={(e) => onCategoryChange(e.target.value)}
          className={`${SELECT_CLASS} md:col-span-2`}
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
          onChange={(e) => onStatusChange(e.target.value as 'Semua' | ReportStatus)}
          className={`${SELECT_CLASS} md:col-span-2`}
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
            onChange={(e) => onYearChange(e.target.value)}
            className={SELECT_CLASS}
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
            onChange={(e) => onPrecisionChange(e.target.value as 'Semua' | PrecisionLevel)}
            className={SELECT_CLASS}
          >
            {PRECISIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={onlyRetender}
              onChange={(e) => onRetenderChange(e.target.checked)}
              className="accent-brand"
            />
            <span>Hanya tender ulang</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span>
            Menampilkan <b className="tabular-nums text-slate-900">{resultsCount}</b> dari{' '}
            {totalCount} paket
          </span>
          <button
            type="button"
            id="reset-filters"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
          >
            <RotateCcw className="size-4" aria-hidden="true" /> Reset
          </button>
        </div>
      </div>
    </section>
  );
}
