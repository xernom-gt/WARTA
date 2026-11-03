import { useState } from 'react';
import { ArrowUpRight, Landmark, Menu, X } from 'lucide-react';
import { DATASET_SUMMARY } from '../../data/wartaData';

const NAV_LINKS = [
  { href: '#masalah-data', label: 'Temuan Data SPSE' },
  { href: '#alur-kerja', label: 'Alur Pantau Warga' },
  { href: '#katalog-proyek', label: 'Proyek Nyata' },
  { href: '#simulasi-konsensus', label: 'Simulasi 3 Suara' },
  { href: '#privasi-faq', label: 'Privasi & FAQ' },
];

interface Props {
  appUrl?: string;
}

export default function LandingNavbar({ appUrl = 'http://localhost:5173' }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-brand-dark bg-brand text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <a href="#" className="flex min-w-0 items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Landmark className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xl font-black tracking-widest">WARTA</span>
            <span className="block truncate text-[11px] text-sky-200 sm:text-xs">
              Warga Pantau Proyek di Depan Rumahmu (Data Terbuka SPSE/INAPROC)
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigasi landing">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-sky-100 transition hover:bg-white/10 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={appUrl}
            className="hidden items-center gap-1.5 rounded-xl border border-action-border bg-action-bg px-4 py-2 text-sm font-bold text-action-text shadow-sm transition hover:bg-white sm:inline-flex"
          >
            Buka Aplikasi WARTA <ArrowUpRight className="size-4" />
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-2 text-sky-100 hover:bg-white/10 lg:hidden"
            aria-label="Menu navigasi"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-brand-dark px-4 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-sky-100 hover:bg-white/10"
              >
                {l.label}
              </a>
            ))}
            <a
              href={appUrl}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-action-bg py-2.5 text-sm font-bold text-action-text"
            >
              Buka Aplikasi WARTA <ArrowUpRight className="size-4" />
            </a>
          </nav>
        </div>
      )}

      {/* Strip ringkasan dataset sama seperti aplikasi utama */}
      <div className="border-t border-white/10 bg-brand-dark/70">
        <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-4 py-1.5 text-[11px] text-sky-100 whitespace-nowrap">
          <span>
            <b className="text-white">{DATASET_SUMMARY.uniqueProjects}</b> proyek unik dari {DATASET_SUMMARY.totalRawPackages} baris paket
          </span>
          <span>
            <b className="text-white">{DATASET_SUMMARY.multiYearPackages}</b> multi-tahun
          </span>
          <span>
            <b className="text-white">{DATASET_SUMMARY.multiLocationPackages}</b> multi-lokasi
          </span>
          <span>
            <b className="text-white">{DATASET_SUMMARY.missingContractCount}</b> tanpa nilai kontrak
          </span>
          <span>
            <b className="text-white">{DATASET_SUMMARY.precisionBreakdown.kabupatenKota}</b> lokasi hanya tingkat kota
          </span>
        </div>
      </div>
    </header>
  );
}
