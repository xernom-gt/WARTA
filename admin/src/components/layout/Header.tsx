import {
  Building2,
  Inbox,
  Landmark,
  LayoutDashboard,
  LogOut,
  Map,
  ShieldCheck,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import type { ActiveScreen } from '../../types/warta';

const TABS: { id: ActiveScreen; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'aduan', label: 'Aduan Warga', icon: Inbox },
  { id: 'proyek', label: 'Kelola Proyek', icon: Building2 },
  { id: 'peta', label: 'Peta Pengawasan', icon: Map },
];

export default function Header() {
  const { activeScreen, navigate, currentUser, queue, logout } = useWarta();
  const pending = queue.filter((q) => q.status === 'menunggu').length;

  const tabActive = (id: ActiveScreen) =>
    id === activeScreen ||
    (id === 'aduan' && (activeScreen === 'verifikasi' || activeScreen === 'lapor' || activeScreen === 'klaim')) ||
    (id === 'peta' && activeScreen === 'detail');

  return (
    <header className="sticky top-0 z-30 border-b border-brand-dark bg-brand text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3.5 sm:px-6">
        {/* Brand Header */}
        <button
          id="brand-home"
          onClick={() => navigate('dashboard')}
          className="flex min-w-0 items-center gap-3 text-left cursor-pointer"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Landmark className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="block text-xl font-black tracking-wider">WARTA</span>
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                Admin
              </span>
            </span>
            <span className="block truncate text-xs text-sky-100">
              Portal Pengawasan & Pengelolaan Instansi Kota
            </span>
          </span>
        </button>

        {/* Tab Navigasi Admin */}
        <nav
          className="order-3 flex w-full gap-1.5 overflow-x-auto rounded-xl bg-brand-dark/50 p-1.5 md:order-none md:ml-auto md:w-auto"
          aria-label="Navigasi admin"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              id={`tab-${id}`}
              onClick={() => navigate(id)}
              aria-current={tabActive(id) ? 'page' : undefined}
              className={`relative flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition md:flex-none cursor-pointer ${
                tabActive(id) ? 'bg-white text-brand shadow-xs' : 'text-sky-100 hover:bg-white/10'
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {label}
              {id === 'aduan' && pending > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-amber-400 text-xs font-black text-amber-950">
                  {pending}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Identitas Akun Admin & Logout */}
        <div className="ml-auto flex items-center gap-2.5 md:ml-0">
          <div className="flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs backdrop-blur-xs">
            <ShieldCheck className="size-4 text-emerald-300" />
            <span className="max-w-[140px] truncate sm:max-w-[200px]">
              {currentUser || 'Admin Dinas'}
            </span>
            <span className="rounded bg-emerald-500/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-200">
              Admin
            </span>
          </div>

          <button
            type="button"
            onClick={logout}
            title="Keluar dari sesi administrator"
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-sky-100 transition hover:bg-rose-500/80 hover:text-white cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
