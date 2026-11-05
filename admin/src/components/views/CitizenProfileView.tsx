import { useState } from 'react';
import {
  BadgeCheck,
  Calendar,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  EyeOff,
  FileText,
  LogIn,
  LogOut,
  MapPin,
  Tag,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { REPORT_CATEGORY_LABELS, getProject } from '../../data/wartaData';
import { cn } from '@/lib/utils';
import StatusBadge from '../common/StatusBadge';
import type { CitizenClaim, CitizenReport, VoteRecord } from '../../types/warta';

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

type SelectedDetail =
  | { type: 'laporan'; data: CitizenReport }
  | { type: 'klaim'; data: CitizenClaim }
  | { type: 'verifikasi'; data: VoteRecord }
  | null;

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

/* ─── Modal / Panel Detail Item ─── */
function ItemDetailModal({
  detail,
  onClose,
  onOpenProject,
}: {
  detail: NonNullable<SelectedDetail>;
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
}) {
  const { data, type } = detail;

  let projectObj = null;
  if ('projectId' in data && data.projectId) {
    try {
      projectObj = getProject(data.projectId);
    } catch {
      // project fallback
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal
    >
      <div className="max-h-[90vh] w-full max-w-xl animate-slide-up overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        {/* Header Modal */}
        <div className="mb-4 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">
                {type === 'laporan'
                  ? 'Detail Laporan'
                  : type === 'klaim'
                    ? 'Detail Klaim Lokasi'
                    : 'Detail Riwayat Suara'}
              </span>
              {'status' in data && <StatusBadge status={data.status} size="sm" />}
            </div>
            <h2 className="text-lg font-extrabold leading-snug text-slate-900">
              {data.projectTitle}
            </h2>
            {'spseCode' in data && (
              <p className="mt-0.5 font-mono text-xs text-slate-500">#{data.spseCode}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Tutup detail"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Konten Detail Spesifik */}
        <div className="space-y-4 text-sm">
          {type === 'laporan' && (
            <>
              <div className="rounded-xl bg-slate-50 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Tag className="size-4 text-brand" />
                  <span className="font-semibold text-slate-700">Kategori Laporan:</span>
                  <span>{REPORT_CATEGORY_LABELS[data.category]}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar className="size-4 text-brand" />
                  <span className="font-semibold text-slate-700">Waktu Kirim:</span>
                  <span>{data.createdAt}</span>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Isi Laporan / Pengamatan Warga
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 leading-relaxed text-slate-800">
                  {data.narrative}
                </div>
              </div>
            </>
          )}

          {type === 'klaim' && (
            <>
              <div className="rounded-xl bg-slate-50 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <MapPin className="size-4 text-brand" />
                  <span className="font-semibold text-slate-700">Tingkat Presisi:</span>
                  <span className="font-semibold capitalize">{data.proposedPrecision}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar className="size-4 text-brand" />
                  <span className="font-semibold text-slate-700">Waktu Usulan:</span>
                  <span>{data.createdAt}</span>
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Alamat / Titik Lokasi yang Diusulkan
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 leading-relaxed text-slate-800">
                  {data.proposedAddress}
                </div>
              </div>

              {data.status === 'diterima' && (
                <div className="flex items-start gap-2 rounded-xl border border-ok-border bg-ok-bg p-3.5 text-xs font-medium text-ok-text">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                  <span>{CANONICAL}</span>
                </div>
              )}
            </>
          )}

          {type === 'verifikasi' && (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span
                  className={cn(
                    'grid size-10 place-items-center rounded-full',
                    data.choice === 'setuju' ? 'bg-ok-bg text-ok-text' : 'bg-bad-bg text-bad-text',
                  )}
                >
                  {data.choice === 'setuju' ? (
                    <ThumbsUp className="size-5" />
                  ) : (
                    <ThumbsDown className="size-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">Pilihan Suara Anda:</p>
                  <p
                    className={cn(
                      'text-base font-extrabold',
                      data.choice === 'setuju' ? 'text-ok-text' : 'text-bad-text',
                    )}
                  >
                    {data.choice === 'setuju' ? 'SETUJU' : 'TIDAK SETUJU'}
                  </p>
                </div>
                <span className="text-xs text-slate-500">{data.votedAt}</span>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Jenis Kiriman yang Diverifikasi:</span>
                  <span className="font-semibold text-slate-800">
                    {data.itemType === 'klaim_lokasi' ? 'Klaim Lokasi' : 'Laporan Kondisi'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Pelapor / Pengusul:</span>
                  <span className="font-semibold text-slate-800">{data.authorDisplayName}</span>
                </div>
              </div>
            </>
          )}

          {/* Tombol Aksi Buka Halaman Paket Proyek Lengkap */}
          {projectObj && (
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenProject(projectObj.id);
                }}
                className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900"
              >
                <span className="flex items-center gap-2 text-xs sm:text-sm">
                  <ExternalLink className="size-4 text-sky-400" />
                  Buka Halaman Detail Proyek Lengkap
                </span>
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Layar Guest ─── */
function GuestScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="mx-auto w-full max-w-sm flex-1 p-4 sm:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-slate-100">
          <UserRound className="size-8 text-slate-400" />
        </span>
        <h1 className="mb-1 text-xl font-extrabold text-slate-900">Belum masuk</h1>
        <p className="mb-6 text-sm leading-relaxed text-slate-500">
          Masuk dengan Nama Tampilan Publik untuk melihat laporan, klaim lokasi, dan riwayat suara
          verifikasi Anda.
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

/* ─── State Kosong ─── */
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

/* ─── Komponen Utama ─── */
export default function CitizenProfileView() {
  const { currentUser, myReports, myClaims, voteHistory, logout, setLoginOpen, navigate } =
    useWarta();
  const [tab, setTab] = useState<Tab>('laporan');
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail>(null);

  if (!currentUser) return <GuestScreen onLogin={() => setLoginOpen(true)} />;

  const totalReports = myReports.length;
  const totalClaims = myClaims.length;
  const totalVotes = voteHistory.length;

  const initials = currentUser
    .replace('Warga_', '')
    .split('_')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
      {/* Modal Detail Item jika ada yang diklik */}
      {selectedDetail && (
        <ItemDetailModal
          detail={selectedDetail}
          onClose={() => setSelectedDetail(null)}
          onOpenProject={(projectId) => navigate('detail', projectId)}
        />
      )}

      {/* ── Header Profil ── */}
      <div className="mb-5 overflow-hidden rounded-2xl border border-brand-dark bg-brand shadow-sm">
        <div className="flex flex-wrap items-center gap-4 p-5">
          <span className="grid size-14 place-items-center rounded-full bg-white/15 text-xl font-black text-white ring-2 ring-white/25">
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-widest text-sky-200 uppercase">Profil Warga</p>
            <h1 className="text-xl font-extrabold text-white">{currentUser}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-sky-200">
              <EyeOff className="size-3.5 shrink-0" />
              Nama tampilan bersifat publik · Email tersembunyi
            </p>
          </div>

          <button
            id="profile-logout"
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <LogOut className="size-4" /> Keluar
          </button>
        </div>

        {/* Statistik Ringkas */}
        <div className="flex items-center justify-around border-t border-white/15 px-4 py-3 text-white">
          <StatItem value={totalReports} label="Laporan" />
          <Divider />
          <StatItem value={totalClaims} label="Klaim Lokasi" />
          <Divider />
          <StatItem value={totalVotes} label="Suara Diberikan" />
        </div>
      </div>

      {/* ── Tab Navigasi ── */}
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

      {/* Petunjuk Interaktif */}
      <p className="mb-2.5 text-xs text-slate-500 flex items-center gap-1">
        <span>💡</span> Klik salah satu kartu untuk melihat rincian detail atau membuka halaman proyek.
      </p>

      {/* ── Daftar Kartu Berinteraksi ── */}
      <ul role="tabpanel" className="space-y-2.5">
        {/* Tab Laporan */}
        {tab === 'laporan' &&
          (myReports.length === 0 ? (
            <Empty tab="laporan" />
          ) : (
            myReports.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDetail({ type: 'laporan', data: r })}
                  className="group w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-brand/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  <div className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand/8 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                      <FileText className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <p className="line-clamp-2 font-bold leading-snug text-slate-900 group-hover:text-brand transition-colors">
                          {r.projectTitle}
                        </p>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="mb-2 text-xs text-slate-500">
                        <span className="font-mono">#{r.spseCode}</span>
                        {' · '}
                        {REPORT_CATEGORY_LABELS[r.category]}
                        {' · '}
                        {r.createdAt}
                      </p>
                      <p className="line-clamp-2 text-sm leading-relaxed text-slate-700">
                        {r.narrative}
                      </p>
                    </div>
                    <ChevronRight className="mt-2 size-5 shrink-0 text-slate-300 group-hover:text-brand transition-colors" />
                  </div>
                </button>
              </li>
            ))
          ))}

        {/* Tab Klaim */}
        {tab === 'klaim' &&
          (myClaims.length === 0 ? (
            <Empty tab="klaim" />
          ) : (
            myClaims.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDetail({ type: 'klaim', data: c })}
                  className="group w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition hover:border-brand/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  <div className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand/8 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                      <MapPin className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <p className="line-clamp-2 font-bold leading-snug text-slate-900 group-hover:text-brand transition-colors">
                          {c.projectTitle}
                        </p>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="mb-2 text-xs text-slate-500">
                        <span className="font-mono">#{c.spseCode}</span>
                        {' · '}
                        Presisi <span className="font-semibold">{c.proposedPrecision}</span>
                        {' · '}
                        {c.createdAt}
                      </p>
                      <p className="text-sm leading-relaxed text-slate-700">{c.proposedAddress}</p>
                      {c.status === 'diterima' && (
                        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-ok-border bg-ok-bg px-2.5 py-2 text-xs font-medium text-ok-text">
                          <BadgeCheck className="mt-0.5 size-3.5 shrink-0" />
                          {CANONICAL}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-2 size-5 shrink-0 text-slate-300 group-hover:text-brand transition-colors" />
                  </div>
                </button>
              </li>
            ))
          ))}

        {/* Tab Verifikasi / Riwayat Suara */}
        {tab === 'verifikasi' &&
          (voteHistory.length === 0 ? (
            <Empty tab="verifikasi" />
          ) : (
            voteHistory.map((v) => (
              <li key={v.itemId + v.votedAt}>
                <button
                  type="button"
                  onClick={() => setSelectedDetail({ type: 'verifikasi', data: v })}
                  className="group flex w-full items-center gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-brand/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-xl transition-colors',
                      v.choice === 'setuju'
                        ? 'bg-ok-bg text-ok-text group-hover:bg-ok-border group-hover:text-white'
                        : 'bg-bad-bg text-bad-text group-hover:bg-bad-border group-hover:text-white',
                    )}
                  >
                    {v.choice === 'setuju' ? (
                      <ThumbsUp className="size-5" />
                    ) : (
                      <ThumbsDown className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 font-bold text-slate-900 group-hover:text-brand transition-colors">
                      {v.projectTitle}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {v.itemType === 'klaim_lokasi' ? 'Klaim lokasi' : 'Laporan kondisi'}
                      {' oleh '}
                      <span className="font-semibold">{v.authorDisplayName}</span>
                      {' · '}
                      {v.votedAt}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold',
                      v.choice === 'setuju'
                        ? 'border-ok-border bg-ok-bg text-ok-text'
                        : 'border-bad-border bg-bad-bg text-bad-text',
                    )}
                  >
                    {v.choice === 'setuju' ? 'SETUJU' : 'TOLAK'}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-slate-300 group-hover:text-brand transition-colors" />
                </button>
              </li>
            ))
          ))}
      </ul>
    </div>
  );
}
