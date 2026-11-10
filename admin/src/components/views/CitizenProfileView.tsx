import { useEffect, useState } from 'react';
import {
  AlertTriangle,
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
  RefreshCw,
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
import { userService, type MyClaimDTO, type MyVoteDTO } from '../../services/user';

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
  | { type: 'klaim'; data: CitizenClaim | MyClaimDTO }
  | { type: 'verifikasi'; data: VoteRecord | MyVoteDTO }
  | null;

/** Badge resolusi konsensus suara */
function ResolutionBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    menunggu: {
      label: 'Menunggu Kuorum',
      cls: 'border-warn-border bg-warn-bg text-warn-text',
    },
    terverifikasi: {
      label: 'Terverifikasi',
      cls: 'border-ok-border bg-ok-bg text-ok-text',
    },
    diterima: {
      label: 'Diterima',
      cls: 'border-ok-border bg-ok-bg text-ok-text',
    },
    ditolak: {
      label: 'Ditolak',
      cls: 'border-bad-border bg-bad-bg text-bad-text',
    },
  };
  const item = cfg[status] ?? { label: status, cls: 'border-slate-200 bg-slate-100 text-slate-600' };
  return (
    <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-bold', item.cls)}>
      {item.label}
    </span>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-xl font-extrabold tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-0.5 truncate text-xs text-sky-100">{label}</p>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px shrink-0 bg-white/20" />;
}

/** Skeleton baris daftar */
function ListSkeleton() {
  return (
    <ul className="space-y-4" role="status" aria-label="Memuat data">
      {[1, 2, 3].map((i) => (
        <li
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white p-6"
        >
          <div className="flex items-start gap-4">
            <div className="size-10 shrink-0 rounded-xl bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
              <div className="h-3 w-full rounded bg-slate-100" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Error state dengan tombol retry */
function FetchError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <li className="flex flex-col items-center rounded-2xl border border-bad-border bg-bad-bg px-6 py-12 text-center text-bad-text">
      <AlertTriangle className="mb-3 size-8" />
      <p className="text-base font-bold">Gagal memuat data</p>
      <p className="mt-1 max-w-xs text-sm">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-bad-text px-4 py-2 text-sm font-semibold text-white"
      >
        <RefreshCw className="size-4" /> Coba Lagi
      </button>
    </li>
  );
}

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  let projectObj = null;
  const projectId =
    'projectId' in data ? data.projectId : 'project_id' in data ? data.project_id : undefined;
  if (projectId) {
    try {
      projectObj = getProject(projectId);
    } catch {
      // project hanya ada di mock — fallback ke null
    }
  }

  // Judul proyek: support mock shape (projectTitle) & API shape (project_title)
  const projectTitle =
    'projectTitle' in data ? data.projectTitle : 'project_title' in data ? data.project_title : '—';

  // Status: support CitizenClaim/CitizenReport (status) & MyClaimDTO (status)
  const status = 'status' in data ? (data as { status: string }).status : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-item-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg animate-pop overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                {type === 'laporan'
                  ? 'Detail Laporan'
                  : type === 'klaim'
                    ? 'Detail Klaim Lokasi'
                    : 'Detail Riwayat Suara'}
              </span>
              {status && (
                <StatusBadge
                  status={status as React.ComponentProps<typeof StatusBadge>['status']}
                  size="sm"
                />
              )}
            </div>
            <h2 id="profile-item-modal-title" className="text-lg leading-snug font-extrabold text-slate-900 sm:text-xl">
              {projectTitle}
            </h2>
            {'spseCode' in data && (
              <p className="mt-0.5 font-mono text-xs text-slate-600">#{data.spseCode}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Tutup detail"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 text-sm">
          {type === 'laporan' && (
            <>
              <div className="space-y-2 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Tag className="size-4 shrink-0 text-brand" />
                  <span className="shrink-0 font-semibold text-slate-700">Kategori Laporan:</span>
                  <span className="truncate">
                    {REPORT_CATEGORY_LABELS[(data as CitizenReport).category]}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar className="size-4 shrink-0 text-brand" />
                  <span className="shrink-0 font-semibold text-slate-700">Waktu Kirim:</span>
                  <span>{(data as CitizenReport).createdAt}</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold tracking-wider text-slate-600 uppercase">
                  Isi Laporan / Pengamatan Warga
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-base leading-relaxed text-slate-800">
                  {(data as CitizenReport).narrative}
                </div>
              </div>
            </>
          )}

          {type === 'klaim' && (() => {
            const isMock = 'proposedAddress' in data && 'spseCode' in data;
            const address = isMock
              ? (data as CitizenClaim).proposedAddress
              : (data as MyClaimDTO).proposed_address;
            const precision = isMock
              ? (data as CitizenClaim).proposedPrecision
              : (data as MyClaimDTO).proposed_precision;
            const createdAt = isMock
              ? (data as CitizenClaim).createdAt
              : (data as MyClaimDTO).created_at;
            const claimStatus = isMock
              ? (data as CitizenClaim).status
              : (data as MyClaimDTO).status;
            return (
              <>
                <div className="space-y-2 rounded-xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <MapPin className="size-4 shrink-0 text-brand" />
                    <span className="shrink-0 font-semibold text-slate-700">Tingkat Presisi:</span>
                    <span className="font-semibold capitalize">{precision}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Calendar className="size-4 shrink-0 text-brand" />
                    <span className="shrink-0 font-semibold text-slate-700">Waktu Usulan:</span>
                    <span>{createdAt}</span>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-bold tracking-wider text-slate-600 uppercase">
                    Alamat / Titik Lokasi yang Diusulkan
                  </p>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-base leading-relaxed text-slate-800">
                    {address}
                  </div>
                </div>

                {claimStatus === 'diterima' && (
                  <div className="flex items-start gap-2 rounded-xl border border-ok-border bg-ok-bg p-4 text-xs font-medium text-ok-text">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                    <span>{CANONICAL}</span>
                  </div>
                )}
              </>
            );
          })()}

          {type === 'verifikasi' && (() => {
            const isMock = 'votedAt' in data;
            const choice = isMock
              ? (data as VoteRecord).choice
              : (data as MyVoteDTO).choice;
            const votedAt = isMock
              ? (data as VoteRecord).votedAt
              : (data as MyVoteDTO).created_at;
            const itemType = isMock
              ? (data as VoteRecord).itemType
              : (data as MyVoteDTO).item_type;
            const authorDisplayName = isMock
              ? (data as VoteRecord).authorDisplayName
              : (data as MyVoteDTO).author_display_name;
            const resolution = !isMock ? (data as MyVoteDTO).resolution : null;
            return (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-full',
                      choice === 'setuju' ? 'bg-ok-bg text-ok-text' : 'bg-bad-bg text-bad-text',
                    )}
                  >
                    {choice === 'setuju' ? (
                      <ThumbsUp className="size-5" />
                    ) : (
                      <ThumbsDown className="size-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-600">Pilihan Suara Anda:</p>
                    <p
                      className={cn(
                        'text-base font-extrabold',
                        choice === 'setuju' ? 'text-ok-text' : 'text-bad-text',
                      )}
                    >
                      {choice === 'setuju' ? 'SETUJU' : 'TIDAK SETUJU'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-600">{votedAt}</span>
                </div>

                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600">Jenis Kiriman:</span>
                    <span className="text-right font-semibold text-slate-800">
                      {itemType === 'klaim_lokasi' ? 'Klaim Lokasi' : 'Laporan Kondisi'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-600">Pelapor / Pengusul:</span>
                    <span className="text-right font-semibold text-slate-800">{authorDisplayName}</span>
                  </div>
                  {resolution && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-600">Status Konsensus:</span>
                      <ResolutionBadge status={resolution.status} />
                    </div>
                  )}
                  {resolution && (
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-600">Progres Suara:</span>
                      <span className="text-right font-semibold text-slate-800">
                        {resolution.votes_agree + resolution.votes_disagree} / {resolution.target_votes}
                      </span>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {projectObj && (
            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenProject(projectObj.id);
                }}
                className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-3.5 font-semibold text-white transition hover:bg-slate-800"
              >
                <span className="flex items-center gap-2 text-sm">
                  <ExternalLink className="size-4 text-sky-300" />
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

function GuestScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
        <span className="mx-auto mb-5 grid size-16 place-items-center rounded-full bg-slate-100 text-slate-600">
          <UserRound className="size-8" />
        </span>
        <h1 className="mb-2 text-2xl font-extrabold text-slate-900">Belum masuk</h1>
        <p className="mb-6 text-base leading-relaxed text-slate-600">
          Masuk dengan Nama Tampilan Publik untuk melihat laporan, klaim lokasi, dan riwayat suara verifikasi Anda.
        </p>
        <button
          id="profile-login"
          onClick={onLogin}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-base font-bold text-white transition hover:bg-brand-dark"
        >
          <LogIn className="size-5" /> Masuk Sekarang
        </button>
      </div>
    </div>
  );
}

function Empty({ tab }: { tab: Tab }) {
  const cfg = {
    laporan: { icon: ClipboardList, text: 'Belum ada laporan yang dikirim.' },
    klaim: { icon: MapPin, text: 'Belum ada klaim lokasi yang diajukan.' },
    verifikasi: { icon: BadgeCheck, text: 'Belum ada riwayat suara verifikasi.' },
  }[tab];
  const Icon = cfg.icon;
  return (
    <li className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-slate-100 text-slate-600">
        <Icon className="size-6" />
      </span>
      <p className="text-base font-bold text-slate-900">Belum ada aktivitas</p>
      <p className="mt-1 max-w-xs text-sm text-slate-600">{cfg.text}</p>
    </li>
  );
}

export default function CitizenProfileView() {
  const { currentUser, myReports, myClaims, voteHistory, logout, setLoginOpen, navigate } =
    useWarta();
  const [tab, setTab] = useState<Tab>('laporan');
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail>(null);

  // State API untuk tab klaim
  const [apiClaims, setApiClaims] = useState<MyClaimDTO[] | null>(null);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // State API untuk tab verifikasi
  const [apiVotes, setApiVotes] = useState<MyVoteDTO[] | null>(null);
  const [loadingVotes, setLoadingVotes] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  // Fetch klaim dari API ketika user login dan tab klaim aktif
  useEffect(() => {
    if (!currentUser || tab !== 'klaim') return;
    let cancelled = false;
    setLoadingClaims(true);
    setClaimError(null);
    userService
      .getMyClaims()
      .then(({ data }) => {
        if (!cancelled) setApiClaims(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : 'Gagal memuat klaim lokasi dari server.';
          setClaimError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingClaims(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, tab]);

  // Fetch riwayat suara dari API ketika user login dan tab verifikasi aktif
  useEffect(() => {
    if (!currentUser || tab !== 'verifikasi') return;
    let cancelled = false;
    setLoadingVotes(true);
    setVoteError(null);
    userService
      .getMyVotes()
      .then(({ data }) => {
        if (!cancelled) setApiVotes(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg =
            err instanceof Error ? err.message : 'Gagal memuat riwayat suara dari server.';
          setVoteError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingVotes(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser, tab]);

  if (!currentUser) return <GuestScreen onLogin={() => setLoginOpen(true)} />;

  // Hitung total dari API jika tersedia, fallback ke WartaContext
  const totalReports = myReports.length;
  const totalClaims = apiClaims !== null ? apiClaims.length : myClaims.length;
  const totalVotes = apiVotes !== null ? apiVotes.length : voteHistory.length;

  const initials = currentUser
    .replace('Warga_', '')
    .split('_')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-10 sm:px-6 sm:py-12">
      {selectedDetail && (
        <ItemDetailModal
          detail={selectedDetail}
          onClose={() => setSelectedDetail(null)}
          onOpenProject={(projectId) => navigate('detail', projectId)}
        />
      )}

      {/* Header kartu profil */}
      <div className="overflow-hidden rounded-2xl border border-brand-dark bg-brand shadow-xs">
        <div className="flex items-center gap-4 p-6">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-white/15 text-xl font-black text-white ring-2 ring-white/25">
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold text-white sm:text-2xl">{currentUser}</h1>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-sky-100">
              <EyeOff className="size-3.5 shrink-0" />
              <span className="truncate">Nama tampilan publik · Email disembunyikan</span>
            </p>
          </div>

          <button
            id="profile-logout"
            onClick={logout}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
          >
            <LogOut className="size-4" /> Keluar
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-white/15 px-4 py-4 text-white">
          <StatItem value={totalReports} label="Laporan" />
          <Divider />
          <StatItem value={totalClaims} label="Klaim Lokasi" />
          <Divider />
          <StatItem value={totalVotes} label="Suara Verifikasi" />
        </div>
      </div>

      {/* Tab switcher */}
      <div
        role="tablist"
        aria-label="Riwayat aktivitas"
        className="grid grid-cols-1 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs sm:grid-cols-3"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`profile-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              'flex min-w-0 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition',
              tab === id
                ? 'bg-brand text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>

      {/* Panel tab */}
      <ul role="tabpanel" className="space-y-4">
        {/* TAB LAPORAN — masih dari WartaContext (tidak ada endpoint history khusus di-task-kan) */}
        {tab === 'laporan' &&
          (myReports.length === 0 ? (
            <Empty tab="laporan" />
          ) : (
            myReports.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDetail({ type: 'laporan', data: r })}
                  className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-4 p-6">
                    <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                      <FileText className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                        <p className="text-base leading-snug font-bold text-slate-900 transition-colors group-hover:text-brand">
                          {r.projectTitle}
                        </p>
                        <div className="shrink-0 self-start sm:self-auto">
                          <StatusBadge status={r.status} size="sm" />
                        </div>
                      </div>
                      <p className="mb-2 text-xs text-slate-600">
                        <span className="font-mono font-semibold">#{r.spseCode}</span>
                        {' · '}
                        <span>{REPORT_CATEGORY_LABELS[r.category]}</span>
                        {' · '}
                        <span>{r.createdAt}</span>
                      </p>
                      <p className="line-clamp-2 text-base leading-relaxed text-slate-700">
                        {r.narrative}
                      </p>
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-slate-600 transition-colors group-hover:text-brand" />
                  </div>
                </button>
              </li>
            ))
          ))}

        {/* TAB KLAIM — data dari API, fallback ke WartaContext */}
        {tab === 'klaim' && (() => {
          if (loadingClaims) return <ListSkeleton />;

          // Gunakan data API jika berhasil dimuat
          if (apiClaims !== null) {
            if (apiClaims.length === 0) return <Empty tab="klaim" />;
            if (claimError) {
              return (
                <FetchError
                  message={claimError}
                  onRetry={() => {
                    setApiClaims(null);
                    setClaimError(null);
                    setTab('laporan');
                    setTimeout(() => setTab('klaim'), 50);
                  }}
                />
              );
            }
            return apiClaims.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDetail({ type: 'klaim', data: c })}
                  className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start gap-4 p-6">
                    <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                      <MapPin className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                        <p className="text-base leading-snug font-bold text-slate-900 transition-colors group-hover:text-brand">
                          Proyek <span className="font-mono text-sm">{c.project_id.slice(0, 8)}…</span>
                        </p>
                        <div className="shrink-0 self-start sm:self-auto">
                          <StatusBadge status={c.status} size="sm" />
                        </div>
                      </div>
                      <p className="mb-2 text-xs text-slate-600">
                        Presisi <span className="font-semibold capitalize">{c.proposed_precision}</span>
                        {' · '}
                        <span>{c.created_at}</span>
                      </p>
                      <p className="line-clamp-2 text-base leading-relaxed text-slate-700">
                        {c.proposed_address}
                      </p>
                      {c.status === 'diterima' && (
                        <p className="mt-3 flex items-start gap-2 rounded-xl border border-ok-border bg-ok-bg px-3 py-2 text-xs font-medium text-ok-text">
                          <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                          <span>{CANONICAL}</span>
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-1 size-5 shrink-0 text-slate-600 transition-colors group-hover:text-brand" />
                  </div>
                </button>
              </li>
            ));
          }

          // Fallback ke WartaContext saat API gagal
          if (claimError) {
            return (
              <FetchError
                message={claimError}
                onRetry={() => {
                  setApiClaims(null);
                  setClaimError(null);
                  setTab('laporan');
                  setTimeout(() => setTab('klaim'), 50);
                }}
              />
            );
          }

          if (myClaims.length === 0) return <Empty tab="klaim" />;
          return myClaims.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedDetail({ type: 'klaim', data: c })}
                className="group w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:shadow-md"
              >
                <div className="flex items-start gap-4 p-6">
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-brand/10 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                    <MapPin className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                      <p className="text-base leading-snug font-bold text-slate-900 transition-colors group-hover:text-brand">
                        {c.projectTitle}
                      </p>
                      <div className="shrink-0 self-start sm:self-auto">
                        <StatusBadge status={c.status} size="sm" />
                      </div>
                    </div>
                    <p className="mb-2 text-xs text-slate-600">
                      <span className="font-mono font-semibold">#{c.spseCode}</span>
                      {' · '}
                      Presisi <span className="font-semibold capitalize">{c.proposedPrecision}</span>
                      {' · '}
                      <span>{c.createdAt}</span>
                    </p>
                    <p className="line-clamp-2 text-base leading-relaxed text-slate-700">
                      {c.proposedAddress}
                    </p>
                    {c.status === 'diterima' && (
                      <p className="mt-3 flex items-start gap-2 rounded-xl border border-ok-border bg-ok-bg px-3 py-2 text-xs font-medium text-ok-text">
                        <BadgeCheck className="mt-0.5 size-4 shrink-0" />
                        <span>{CANONICAL}</span>
                      </p>
                    )}
                  </div>
                  <ChevronRight className="mt-1 size-5 shrink-0 text-slate-600 transition-colors group-hover:text-brand" />
                </div>
              </button>
            </li>
          ));
        })()}

        {/* TAB VERIFIKASI — data dari API, fallback ke WartaContext */}
        {tab === 'verifikasi' && (() => {
          if (loadingVotes) return <ListSkeleton />;

          // Gunakan data API jika berhasil dimuat
          if (apiVotes !== null) {
            if (apiVotes.length === 0) return <Empty tab="verifikasi" />;
            if (voteError) {
              return (
                <FetchError
                  message={voteError}
                  onRetry={() => {
                    setApiVotes(null);
                    setVoteError(null);
                    setTab('laporan');
                    setTimeout(() => setTab('verifikasi'), 50);
                  }}
                />
              );
            }
            return apiVotes.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDetail({ type: 'verifikasi', data: v })}
                  className="group flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:shadow-md"
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
                    <div className="mb-1 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                      <p className="line-clamp-1 text-base font-bold text-slate-900 transition-colors group-hover:text-brand">
                        {v.project_title}
                      </p>
                      <div className="flex shrink-0 items-center gap-2 self-start sm:self-auto">
                        <span
                          className={cn(
                            'rounded-full border px-2.5 py-0.5 text-xs font-bold',
                            v.choice === 'setuju'
                              ? 'border-ok-border bg-ok-bg text-ok-text'
                              : 'border-bad-border bg-bad-bg text-bad-text',
                          )}
                        >
                          {v.choice === 'setuju' ? 'SETUJU' : 'TOLAK'}
                        </span>
                        <ResolutionBadge status={v.resolution.status} />
                      </div>
                    </div>
                    <p className="truncate text-xs text-slate-600">
                      {v.item_type === 'klaim_lokasi' ? 'Klaim lokasi' : 'Laporan kondisi'}
                      {' oleh '}
                      <span className="font-semibold">{v.author_display_name}</span>
                      {' · '}
                      {v.created_at}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-slate-600 transition-colors group-hover:text-brand" />
                </button>
              </li>
            ));
          }

          // Fallback ke WartaContext saat API gagal
          if (voteError) {
            return (
              <FetchError
                message={voteError}
                onRetry={() => {
                  setApiVotes(null);
                  setVoteError(null);
                  setTab('laporan');
                  setTimeout(() => setTab('verifikasi'), 50);
                }}
              />
            );
          }

          if (voteHistory.length === 0) return <Empty tab="verifikasi" />;
          return voteHistory.map((v) => (
            <li key={v.itemId + v.votedAt}>
              <button
                type="button"
                onClick={() => setSelectedDetail({ type: 'verifikasi', data: v })}
                className="group flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-slate-300 hover:shadow-md"
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
                  <div className="mb-1 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <p className="line-clamp-1 text-base font-bold text-slate-900 transition-colors group-hover:text-brand">
                      {v.projectTitle}
                    </p>
                    <span
                      className={cn(
                        'shrink-0 self-start rounded-full border px-2.5 py-0.5 text-xs font-bold sm:self-auto',
                        v.choice === 'setuju'
                          ? 'border-ok-border bg-ok-bg text-ok-text'
                          : 'border-bad-border bg-bad-bg text-bad-text',
                      )}
                    >
                      {v.choice === 'setuju' ? 'SETUJU' : 'TOLAK'}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-600">
                    {v.itemType === 'klaim_lokasi' ? 'Klaim lokasi' : 'Laporan kondisi'}
                    {' oleh '}
                    <span className="font-semibold">{v.authorDisplayName}</span>
                    {' · '}
                    {v.votedAt}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-slate-600 transition-colors group-hover:text-brand" />
              </button>
            </li>
          ));
        })()}
      </ul>
    </div>
  );
}
