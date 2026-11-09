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
  Loader2,
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
  if ('projectId' in data && data.projectId) {
    try {
      projectObj = getProject(data.projectId);
    } catch {
      // project fallback
    }
  }

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
              {'status' in data && <StatusBadge status={data.status} size="sm" />}
            </div>
            <h2 id="profile-item-modal-title" className="text-lg leading-snug font-extrabold text-slate-900 sm:text-xl">
              {data.projectTitle}
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
                  <span className="truncate">{REPORT_CATEGORY_LABELS[data.category]}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar className="size-4 shrink-0 text-brand" />
                  <span className="shrink-0 font-semibold text-slate-700">Waktu Kirim:</span>
                  <span>{data.createdAt}</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold tracking-wider text-slate-600 uppercase">
                  Isi Laporan / Pengamatan Warga
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-base leading-relaxed text-slate-800">
                  {data.narrative}
                </div>
              </div>
            </>
          )}

          {type === 'klaim' && (
            <>
              <div className="space-y-2 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <MapPin className="size-4 shrink-0 text-brand" />
                  <span className="shrink-0 font-semibold text-slate-700">Tingkat Presisi:</span>
                  <span className="font-semibold capitalize">{data.proposedPrecision}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <Calendar className="size-4 shrink-0 text-brand" />
                  <span className="shrink-0 font-semibold text-slate-700">Waktu Usulan:</span>
                  <span>{data.createdAt}</span>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-bold tracking-wider text-slate-600 uppercase">
                  Alamat / Titik Lokasi yang Diusulkan
                </p>
                <div className="rounded-xl border border-slate-200 bg-white p-4 text-base leading-relaxed text-slate-800">
                  {data.proposedAddress}
                </div>
              </div>

              {data.status === 'diterima' && (
                <div className="flex items-start gap-2 rounded-xl border border-ok-border bg-ok-bg p-4 text-xs font-medium text-ok-text">
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
                    'grid size-10 shrink-0 place-items-center rounded-full',
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
                  <p className="text-xs text-slate-600">Pilihan Suara Anda:</p>
                  <p
                    className={cn(
                      'text-base font-extrabold',
                      data.choice === 'setuju' ? 'text-ok-text' : 'text-bad-text',
                    )}
                  >
                    {data.choice === 'setuju' ? 'SETUJU' : 'TIDAK SETUJU'}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-600">{data.votedAt}</span>
              </div>

              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">Jenis Kiriman:</span>
                  <span className="text-right font-semibold text-slate-800">
                    {data.itemType === 'klaim_lokasi' ? 'Klaim Lokasi' : 'Laporan Kondisi'}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-600">Pelapor / Pengusul:</span>
                  <span className="text-right font-semibold text-slate-800">{data.authorDisplayName}</span>
                </div>
              </div>
            </>
          )}

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
  const { currentUser, myReports, myClaims, voteHistory, logout, setLoginOpen, navigate, mapCondition, setMapCondition } =
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
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-10 sm:px-6 sm:py-12">
      {selectedDetail && (
        <ItemDetailModal
          detail={selectedDetail}
          onClose={() => setSelectedDetail(null)}
          onOpenProject={(projectId) => navigate('detail', projectId)}
        />
      )}

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

      {mapCondition === 'loading' ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center"
        >
          <Loader2 className="mb-3 size-8 animate-spin text-brand" />
          <p className="text-base font-bold text-slate-900">Memuat riwayat kontribusi…</p>
        </div>
      ) : mapCondition === 'tile-error' ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-2xl border border-bad-border bg-bad-bg px-6 py-12 text-center text-bad-text"
        >
          <AlertTriangle className="mb-3 size-8" />
          <p className="text-base font-bold">Gagal memuat riwayat aktivitas</p>
          <button
            onClick={() => setMapCondition('normal')}
            className="mt-4 rounded-xl bg-bad-text px-4 py-2 text-sm font-semibold text-white"
          >
            Muat Ulang
          </button>
        </div>
      ) : (
        <ul role="tabpanel" className="space-y-4">
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

          {tab === 'klaim' &&
            (myClaims.length === 0 ? (
              <Empty tab="klaim" />
            ) : (
              myClaims.map((c) => (
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
              ))
            ))}

          {tab === 'verifikasi' &&
            (voteHistory.length === 0 ? (
              <Empty tab="verifikasi" />
            ) : (
              voteHistory.map((v) => (
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
              ))
            ))}
        </ul>
      )}
    </div>
  );
}
