import { useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  ClipboardList,
  EyeOff,
  FileText,
  LogIn,
  LogOut,
  MapPin,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { REPORT_CATEGORY_LABELS } from '../../data/wartaData';
import { cn } from '@/lib/utils';
import StatusBadge from '../common/StatusBadge';

type Tab = 'laporan' | 'klaim' | 'verifikasi';

interface TabDef {
  id: Tab;
  label: string;
  icon: typeof FileText;
}

const TABS: TabDef[] = [
  { id: 'laporan', label: 'Laporan Saya', icon: FileText },
  { id: 'klaim', label: 'Klaim Lokasi', icon: MapPin },
  { id: 'verifikasi', label: 'Riwayat Suara', icon: BadgeCheck },
];

const CANONICAL = 'Klaim lokasi ini sudah terverifikasi dan menjadi lokasi kanonik paket.';

/** Statistik ringkas di header profil */
function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-xl font-extrabold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-sky-200">{label}</p>
    </div>
  );
}

function Divider() {
  return <div className="hidden h-8 w-px bg-white/20 sm:block" />;
}

/** Kartu laporan */
function ReportCard({ report }: { report: ReturnType<typeof useReports>[number] }) {
  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand/8 text-brand">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="line-clamp-2 font-bold leading-snug text-slate-900">{report.projectTitle}</p>
            <StatusBadge status={report.status} />
          </div>
          <p className="mb-2 text-xs text-slate-500">
            <span className="font-mono">#{report.spseCode}</span>
            {' · '}
            {REPORT_CATEGORY_LABELS[report.category]}
            {' · '}
            {report.createdAt}
          </p>
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-700">{report.narrative}</p>
        </div>
      </div>
    </li>
  );
}

/** Kartu klaim lokasi */
function ClaimCard({ claim }: { claim: ReturnType<typeof useClaims>[number] }) {
  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand/8 text-brand">
          <MapPin className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
            <p className="line-clamp-2 font-bold leading-snug text-slate-900">{claim.projectTitle}</p>
            <StatusBadge status={claim.status} />
          </div>
          <p className="mb-2 text-xs text-slate-500">
            <span className="font-mono">#{claim.spseCode}</span>
            {' · '}
            Presisi <span className="font-semibold">{claim.proposedPrecision}</span>
            {' · '}
            {claim.createdAt}
          </p>
          <p className="text-sm leading-relaxed text-slate-700">{claim.proposedAddress}</p>
          {claim.status === 'diterima' && (
            <p className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-ok-border bg-ok-bg px-2.5 py-2 text-xs font-medium text-ok-text">
              <BadgeCheck className="mt-0.5 size-3.5 shrink-0" />
              {CANONICAL}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/** Kartu riwayat suara */
function VoteCard({ vote }: { vote: ReturnType<typeof useVotes>[number] }) {
  const isSetuju = vote.choice === 'setuju';
  return (
    <li className="flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          isSetuju ? 'bg-ok-bg text-ok-text' : 'bg-bad-bg text-bad-text',
        )}
      >
        {isSetuju ? <ThumbsUp className="size-4" /> : <ThumbsDown className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 font-bold text-slate-900">{vote.projectTitle}</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {vote.itemType === 'klaim_lokasi' ? 'Klaim lokasi' : 'Laporan kondisi'}
          {' oleh '}
          <span className="font-semibold">{vote.authorDisplayName}</span>
          {' · '}
          {vote.votedAt}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold',
          isSetuju
            ? 'border-ok-border bg-ok-bg text-ok-text'
            : 'border-bad-border bg-bad-bg text-bad-text',
        )}
      >
        {isSetuju ? 'SETUJU' : 'TOLAK'}
      </span>
    </li>
  );
}

/** State kosong per tab */
function Empty({ tab }: { tab: Tab }) {
  const cfg = {
    laporan: { icon: ClipboardList, text: 'Belum ada laporan yang dikirim.' },
    klaim: { icon: MapPin, text: 'Belum ada klaim lokasi yang diajukan.' },
    verifikasi: { icon: BadgeCheck, text: 'Belum ada riwayat suara verifikasi.' },
  }[tab];
  const Icon = cfg.icon;
  return (
    <li className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-slate-100">
        <Icon className="size-6 text-slate-400" />
      </span>
      <p className="text-sm font-bold text-slate-800">Belum ada aktivitas</p>
      <p className="mt-1 max-w-[16rem] text-xs text-slate-500">{cfg.text}</p>
    </li>
  );
}

/* Tipe-tipe helper untuk menghindari import circular */
type UseReports = ReturnType<typeof useWarta>['myReports'];
type UseClaims = ReturnType<typeof useWarta>['myClaims'];
type UseVotes = ReturnType<typeof useWarta>['voteHistory'];
declare function useReports(): UseReports;
declare function useClaims(): UseClaims;
declare function useVotes(): UseVotes;

/* ─── Layar tidak login ─── */
function GuestScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="mx-auto w-full max-w-sm flex-1 p-4 sm:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-slate-100">
          <UserRound className="size-8 text-slate-400" />
        </span>
        <h1 className="mb-1 text-xl font-extrabold text-slate-900">Belum masuk</h1>
        <p className="mb-6 text-sm leading-relaxed text-slate-500">
          Masuk dengan Nama Tampilan Publik untuk melihat laporan, klaim lokasi, dan riwayat suara verifikasi Anda.
        </p>
        <button
          id="profile-login"
          onClick={onLogin}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 font-semibold text-white transition hover:bg-brand-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          <LogIn className="size-4" /> Masuk sekarang
        </button>
      </div>
    </div>
  );
}

/* ─── Komponen utama ─── */
export default function CitizenProfileView() {
  const { currentUser, myReports, myClaims, voteHistory, logout, setLoginOpen } = useWarta();
  const [tab, setTab] = useState<Tab>('laporan');

  if (!currentUser) return <GuestScreen onLogin={() => setLoginOpen(true)} />;

  /* Hitung statistik untuk header */
  const totalReports = myReports.length;
  const totalClaims = myClaims.length;
  const totalVotes = voteHistory.length;

  /* Inisial avatar — ambil 1-2 huruf pertama dari nama tampilan */
  const initials = currentUser
    .replace('Warga_', '')
    .split('_')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
      {/* ── Header profil ── */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-brand-dark bg-brand shadow-sm">
        <div className="flex flex-wrap items-center gap-4 p-5">
          {/* Avatar */}
          <span className="grid size-14 place-items-center rounded-full bg-white/15 text-xl font-black text-white ring-2 ring-white/25">
            {initials}
          </span>

          {/* Nama + privacy notice */}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-widest text-sky-200 uppercase">Profil Warga</p>
            <h1 className="text-xl font-extrabold text-white">{currentUser}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-sky-200">
              <EyeOff className="size-3.5 shrink-0" />
              Nama tampilan bersifat publik · Email tersembunyi
            </p>
          </div>

          {/* Tombol keluar */}
          <button
            id="profile-logout"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <LogOut className="size-4" /> Keluar
          </button>
        </div>

        {/* Statistik ringkas */}
        <div className="flex items-center justify-around border-t border-white/15 px-4 py-3 text-white">
          <StatItem value={totalReports} label="Laporan" />
          <Divider />
          <StatItem value={totalClaims} label="Klaim Lokasi" />
          <Divider />
          <StatItem value={totalVotes} label="Suara Diberikan" />
        </div>
      </div>

      {/* ── Tab navigasi ── */}
      <div
        role="tablist"
        aria-label="Riwayat aktivitas"
        className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`profile-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
              tab === id
                ? 'bg-brand text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Konten tab ── */}
      <ul role="tabpanel" className="space-y-2.5">
        {tab === 'laporan' && (
          myReports.length === 0
            ? <Empty tab="laporan" />
            : myReports.map((r) => <ReportCard key={r.id} report={r} />)
        )}

        {tab === 'klaim' && (
          myClaims.length === 0
            ? <Empty tab="klaim" />
            : myClaims.map((c) => <ClaimCard key={c.id} claim={c} />)
        )}

        {tab === 'verifikasi' && (
          voteHistory.length === 0
            ? <Empty tab="verifikasi" />
            : voteHistory.map((v) => <VoteCard key={v.itemId + v.votedAt} vote={v} />)
        )}
      </ul>
    </div>
  );
}

/* ── Tombol kembali (hanya di versi mobile, digunakan di dalam layar profil detail nanti) ── */
export function ProfileBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="-ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-action-border focus-visible:outline-none lg:hidden"
      aria-label="Kembali"
    >
      <ArrowLeft className="size-4" />
    </button>
  );
}
