import { BadgeCheck, FilePlus2, Landmark, LogIn, Map, UserRound } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import type { ActiveScreen } from '../../types/warta';

const TABS: { id: ActiveScreen; label: string; icon: typeof Map }[] = [
  { id: 'verifikasi', label: 'Aduan & Verifikasi', icon: BadgeCheck },
  { id: 'peta', label: 'Proyek & Peta', icon: Map },
  { id: 'lapor', label: 'Buat Pengaduan', icon: FilePlus2 },
  { id: 'profil', label: 'Profil Warga', icon: UserRound },
];

export default function Header() {
  const { activeScreen, navigate, currentUser, setLoginOpen, queue } = useWarta();
  const pending = queue.filter((q) => q.status === 'menunggu').length;
  const tabActive = (id: ActiveScreen) =>
    id === activeScreen ||
    (id === 'peta' && activeScreen === 'detail') ||
    (id === 'lapor' && activeScreen === 'klaim');

  return (
    <header className="sticky top-0 z-30 border-b border-brand-dark bg-brand text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3.5 sm:px-6">
        <button id="brand-home" onClick={() => navigate('verifikasi')} className="flex min-w-0 items-center gap-3 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Landmark className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-xl font-black tracking-wider">WARTA</span>
            <span className="block truncate text-xs text-sky-100">
              Warga Pantau Proyek Publik (Data SPSE/INAPROC)
            </span>
          </span>
        </button>

        <nav
          className="order-3 flex w-full gap-1.5 overflow-x-auto rounded-xl bg-brand-dark/50 p-1.5 md:order-none md:ml-auto md:w-auto"
          aria-label="Navigasi utama"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              onClick={() => navigate(id)}
              aria-current={tabActive(id) ? 'page' : undefined}
              className={`relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition md:flex-none ${
                tabActive(id) ? 'bg-white text-brand shadow-xs' : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {label}
              {id === 'verifikasi' && pending > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-wait-bg text-xs font-bold text-wait-text">
                  {pending}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="ml-auto md:ml-0">
          {currentUser ? (
            <button
              onClick={() => navigate('profil')}
              className="flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              <UserRound className="size-4" />
              {currentUser}
            </button>
          ) : (
            <button
              id="header-login"
              onClick={() => setLoginOpen(true)}
              className="flex items-center gap-2 rounded-full bg-action-bg px-4 py-2 text-sm font-semibold text-action-text hover:bg-white"
            >
              <LogIn className="size-4" /> Masuk
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
