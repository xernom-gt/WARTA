import { BadgeCheck, Landmark, LogIn, Map, UserRound } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { DATASET_SUMMARY } from '../../data/wartaData';
import type { ActiveScreen } from '../../types/warta';

const TABS: { id: ActiveScreen; label: string; icon: typeof Map }[] = [
  { id: 'peta', label: 'Peta', icon: Map },
  { id: 'verifikasi', label: 'Verifikasi', icon: BadgeCheck },
  { id: 'profil', label: 'Profil', icon: UserRound },
];

export default function Header() {
  const { activeScreen, navigate, currentUser, setLoginOpen, queue } = useWarta();
  const pending = queue.filter((q) => q.status === 'menunggu').length;
  const tabActive = (id: ActiveScreen) =>
    id === activeScreen || (id === 'peta' && ['detail', 'lapor', 'klaim'].includes(activeScreen));

  return (
    <header className="sticky top-0 z-30 border-b border-brand-dark bg-brand text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
        <button id="brand-home" onClick={() => navigate('peta')} className="flex min-w-0 items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Landmark className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xl font-black tracking-widest">WARTA</span>
            <span className="block truncate text-[11px] text-sky-200 sm:text-xs">
              Warga Pantau Proyek di Depan Rumahmu (Data Terbuka SPSE/INAPROC)
            </span>
          </span>
        </button>

        <nav className="order-3 flex w-full gap-1 rounded-xl bg-brand-dark/60 p-1 md:order-none md:ml-auto md:w-auto" aria-label="Navigasi utama">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              onClick={() => navigate(id)}
              aria-current={tabActive(id) ? 'page' : undefined}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition md:flex-none ${
                tabActive(id) ? 'bg-white text-brand shadow' : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <Icon className="size-4" />
              {label}
              {id === 'verifikasi' && pending > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-wait-bg text-[11px] font-bold text-wait-text">{pending}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="ml-auto md:ml-0">
          {currentUser ? (
            <span className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold">
              <UserRound className="size-4" />{currentUser}
            </span>
          ) : (
            <button id="header-login" onClick={() => setLoginOpen(true)} className="flex items-center gap-2 rounded-full bg-action-bg px-3 py-1.5 text-sm font-semibold text-action-text hover:bg-white">
              <LogIn className="size-4" /> Masuk
            </button>
          )}
        </div>
      </div>

      {/* Dataset banner */}
      <div className="border-t border-white/10 bg-brand-dark/70">
        <div className="mx-auto flex max-w-7xl gap-4 overflow-x-auto px-4 py-1.5 text-[11px] text-sky-100 whitespace-nowrap">
          <span><b className="text-white">{DATASET_SUMMARY.uniqueProjects}</b> proyek unik dari {DATASET_SUMMARY.totalRawPackages} baris paket</span>
          <span><b className="text-white">{DATASET_SUMMARY.multiYearPackages}</b> multi-tahun</span>
          <span><b className="text-white">{DATASET_SUMMARY.multiLocationPackages}</b> multi-lokasi</span>
          <span><b className="text-white">{DATASET_SUMMARY.missingContractCount}</b> tanpa nilai kontrak</span>
          <span><b className="text-white">{DATASET_SUMMARY.precisionBreakdown.kabupatenKota}</b> lokasi hanya tingkat kota</span>
        </div>
      </div>
    </header>
  );
}
