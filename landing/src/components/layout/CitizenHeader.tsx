import { FilePlus2, Landmark, LogIn, Map, MessageSquareText, UserRound } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import type { ActiveScreen } from '../../types/warta';

interface NavTab {
  id: ActiveScreen;
  label: string;
  shortLabel: string;
  icon: typeof Map;
}

const NAV_TABS: NavTab[] = [
  { id: 'aduan', label: 'Aduan Warga', shortLabel: 'Aduan', icon: MessageSquareText },
  { id: 'peta', label: 'Proyek & Peta', shortLabel: 'Proyek', icon: Map },
  { id: 'lapor', label: 'Buat Pengaduan', shortLabel: 'Lapor', icon: FilePlus2 },
  { id: 'profil', label: 'Aduan Saya', shortLabel: 'Aduan Saya', icon: UserRound },
];

export default function CitizenHeader() {
  const { activeScreen, navigate, currentUser, userProfile, setLoginOpen, queue, myReports } = useWarta();

  const totalReports = queue.length;
  const draftCount = myReports.filter((r) => r.status === 'draft').length;

  const isTabActive = (id: ActiveScreen) => {
    if (id === 'peta') return activeScreen === 'peta' || activeScreen === 'detail';
    if (id === 'lapor') return activeScreen === 'lapor' || activeScreen === 'klaim';
    if (id === 'aduan') return activeScreen === 'aduan' || activeScreen === 'verifikasi';
    return activeScreen === id;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Brand */}
        <button
          type="button"
          id="brand-home"
          onClick={() => navigate('aduan')}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white">
            <Landmark className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-extrabold tracking-tight text-slate-900">WARTA</span>
            <span className="block truncate text-xs text-slate-600">
              Pengaduan & pantau proyek publik SPSE
            </span>
          </span>
        </button>

        {/* Main Navigation */}
        <nav
          className="order-3 flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1 lg:order-none lg:w-auto"
          aria-label="Navigasi portal warga"
        >
          {NAV_TABS.map(({ id, label, shortLabel, icon: Icon }) => {
            const active = isTabActive(id);
            return (
              <button
                key={id}
                type="button"
                id={`nav-tab-${id}`}
                onClick={() => navigate(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition lg:flex-none ${
                  active
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-slate-700 hover:bg-white hover:text-slate-900'
                }`}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{shortLabel}</span>
                {id === 'aduan' && totalReports > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                    }`}
                  >
                    {totalReports}
                  </span>
                )}
                {id === 'profil' && currentUser && draftCount > 0 && (
                  <span
                    title={`${draftCount} draf belum dikirim`}
                    className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                      active ? 'bg-amber-300 text-slate-900' : 'bg-wait-bg text-wait-text'
                    }`}
                  >
                    {draftCount} draf
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Account Action */}
        <div className="flex items-center gap-2.5">
          {currentUser ? (
            <button
              type="button"
              onClick={() => navigate('profil')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-left text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <span className="grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">
                {currentUser.replace('Warga_', '').slice(0, 2).toUpperCase()}
              </span>
              <span className="max-w-32 truncate">{currentUser}</span>
              {userProfile && !userProfile.emailVerified && (
                <span className="size-2 rounded-full bg-amber-500" title="Email belum diverifikasi" />
              )}
            </button>
          ) : (
            <button
              type="button"
              id="header-login"
              onClick={() => setLoginOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <LogIn className="size-4" aria-hidden="true" /> Masuk / Daftar
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
