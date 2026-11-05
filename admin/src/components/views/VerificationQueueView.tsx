import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  ImageOff,
  Inbox,
  ListFilter,
  MapPin,
  Search,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { cn } from '@/lib/utils';
import type { VerificationItem } from '../../types/warta';
import ExifCheckBadge from '../common/ExifCheckBadge';
import StatusBadge from '../common/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

type TypeFilter = 'semua' | 'laporan_kondisi' | 'klaim_lokasi';
type StatusFilter = 'semua' | 'menunggu' | 'terverifikasi' | 'diterima' | 'ditolak';
type SortKey = 'default' | 'dukungan' | 'kontra';

const TYPE_LABEL: Record<VerificationItem['itemType'], string> = {
  laporan_kondisi: 'Laporan Kondisi',
  klaim_lokasi: 'Klaim Lokasi',
};

export default function VerificationQueueView() {
  const { queue, vote, canVote } = useWarta();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('semua');
  const [status, setStatus] = useState<StatusFilter>('semua');
  const [sort, setSort] = useState<SortKey>('default');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = queue.filter((it) => {
      const matchTerm =
        !term ||
        [it.projectTitle, it.spseCode, it.authorDisplayName, it.satker, it.categoryLabel].some((v) =>
          v.toLowerCase().includes(term),
        );
      const matchType = type === 'semua' || it.itemType === type;
      const matchStatus = status === 'semua' || it.status === status;
      return matchTerm && matchType && matchStatus;
    });
    if (sort === 'dukungan') return [...filtered].sort((a, b) => b.votesAgree - a.votesAgree);
    if (sort === 'kontra') return [...filtered].sort((a, b) => b.votesDisagree - a.votesDisagree);
    return filtered;
  }, [queue, q, type, status, sort]);

  const pendingCount = queue.filter((it) => it.status === 'menunggu').length;
  // Jika item terpilih tersaring keluar, kembalikan ke mode daftar agar tidak ada panel kosong.
  const selectedId = activeId && list.some((it) => it.id === activeId) ? activeId : null;
  const active = list.find((it) => it.id === selectedId) ?? list[0] ?? null;
  const detailOpen = selectedId !== null;
  const filterActive = type !== 'semua' || status !== 'semua' || sort !== 'default' || q.trim() !== '';

  const resetFilter = () => {
    setQ('');
    setType('semua');
    setStatus('semua');
    setSort('default');
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 sm:py-6">
      {/* Kepala halaman */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-widest text-action-border uppercase">Panel Warga</p>
          <h1 className="text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl">
            Antrean Verifikasi
          </h1>
        </div>
        <p className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
          <Users className="size-3.5 text-action-border" />
          {pendingCount} menunggu · kuorum 3 suara
        </p>
      </div>

      {/* Toolbar filter */}
      <div className="mb-4 rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-sm sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-300 px-2.5 transition-colors focus-within:border-action-border focus-within:ring-2 focus-within:ring-action-border/30">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              id="verify-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari paket, kode tender, atau pelapor…"
              className="w-full min-w-0 bg-transparent py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </label>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
              <SelectTrigger id="verify-type" aria-label="Jenis kiriman" className="sm:w-[9.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua jenis</SelectItem>
                <SelectItem value="laporan_kondisi">Laporan kondisi</SelectItem>
                <SelectItem value="klaim_lokasi">Klaim lokasi</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger id="verify-status" aria-label="Status verifikasi" className="sm:w-[9.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua status</SelectItem>
                <SelectItem value="menunggu">Menunggu</SelectItem>
                <SelectItem value="terverifikasi">Terverifikasi</SelectItem>
                <SelectItem value="diterima">Diterima</SelectItem>
                <SelectItem value="ditolak">Ditolak</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger id="verify-sort" aria-label="Urutkan" className="col-span-2 sm:w-[9.5rem]">
                <span className="flex min-w-0 items-center gap-1.5">
                  <ArrowUpDown className="size-3.5 shrink-0 text-slate-400" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Urutan asli</SelectItem>
                <SelectItem value="dukungan">Dukungan terbanyak</SelectItem>
                <SelectItem value="kontra">Penolakan terbanyak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <ListFilter className="size-3.5" />
            {list.length} dari {queue.length} kiriman
          </span>
          {filterActive && (
            <button
              id="verify-reset"
              onClick={resetFilter}
              className="font-semibold text-action-border underline-offset-2 hover:underline"
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      {/* Master-detail */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Daftar */}
        <ul className="space-y-2 lg:w-[21rem] lg:shrink-0">
          {list.length === 0 && (
            <li className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
              <span className="mb-3 grid size-12 place-items-center rounded-full bg-slate-100">
                <Inbox className="size-6 text-slate-400" />
              </span>
              <p className="text-sm font-bold text-slate-800">Tidak ada kiriman</p>
              <p className="mt-1 max-w-[16rem] text-xs text-slate-500">
                Longgarkan kata kunci atau filter jenis dan status.
              </p>
              {filterActive && (
                <button
                  onClick={resetFilter}
                  className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
                >
                  Reset filter
                </button>
              )}
            </li>
          )}

          {list.map((it) => {
            const isActive = active?.id === it.id;
            return (
              <li key={it.id}>
                <button
                  id={`queue-${it.id}`}
                  onClick={() => setActiveId(it.id)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    'group w-full rounded-xl border bg-white p-3 text-left transition-all',
                    'focus-visible:ring-2 focus-visible:ring-action-border focus-visible:ring-offset-2 focus-visible:outline-none',
                    isActive
                      ? 'border-brand/40 shadow-sm ring-1 ring-brand/15'
                      : 'border-slate-200/80 hover:border-slate-300 hover:shadow-sm',
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-slate-500">
                      {TYPE_LABEL[it.itemType]}
                    </span>
                    <StatusBadge status={it.status} />
                  </div>
                  <p className="line-clamp-2 text-sm leading-snug font-bold text-slate-900">
                    {it.projectTitle}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-slate-500">#{it.spseCode}</p>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <Quorum
                      agree={it.votesAgree}
                      disagree={it.votesDisagree}
                      target={it.targetVotes}
                      compact
                    />
                    <span className="shrink-0 text-xs font-semibold text-slate-600 tabular-nums">
                      {it.votesAgree}/{it.targetVotes}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Detail */}
        {active ? (
          <article
            className={cn(
              'min-w-0 flex-1',
              detailOpen
                ? 'fixed inset-0 z-50 overflow-y-auto bg-slate-50 p-3 sm:p-4 lg:static lg:z-auto lg:overflow-visible lg:bg-transparent lg:p-0'
                : 'hidden lg:block',
            )}
          >
            <div className="mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
              {/* Bar atas detail */}
              <div className="flex items-start gap-3 border-b border-slate-100 p-3 sm:p-4">
                <button
                  onClick={() => setActiveId(null)}
                  className="-ml-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-action-border focus-visible:outline-none lg:hidden"
                  aria-label="Kembali ke daftar"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-600">
                      {TYPE_LABEL[active.itemType]}
                    </span>
                    <span className="truncate text-xs text-slate-500">{active.categoryLabel}</span>
                  </div>
                  <h2 className="text-base leading-snug font-extrabold text-slate-900 sm:text-lg">
                    {active.projectTitle}
                  </h2>
                  <p className="mt-0.5 truncate text-xs text-slate-500 sm:text-xs">
                    <span className="font-mono">#{active.spseCode}</span> · {active.satker}
                  </p>
                </div>
                <div className="shrink-0">
                  <StatusBadge status={active.status} />
                </div>
              </div>

              <div className="space-y-3.5 p-3 sm:p-4">
                <Photo src={active.photoUrl} alt={`Foto bukti ${active.projectTitle}`} />

                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <Field label="Pelapor" value={active.authorDisplayName} strong />
                  <Field label="Dikirim" value={active.createdAt} />
                  <div className="col-span-2 flex items-start gap-1.5 text-slate-600">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand" />
                    <span className="min-w-0">{active.distanceFromProject}</span>
                  </div>
                  {active.itemType === 'klaim_lokasi' && (
                    <div className="col-span-2 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
                      <p className="mb-0.5 text-xs font-semibold text-slate-500">Usulan lokasi</p>
                      <p className="leading-relaxed">{active.proposedAddress}</p>
                    </div>
                  )}
                </dl>

                <ExifCheckBadge valid={active.exifValid} />

                <p className="rounded-lg border-l-2 border-slate-300 bg-slate-50 px-3 py-2.5 text-sm leading-relaxed text-slate-700">
                  {active.narrative}
                </p>

                {/* Kuorum */}
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Kuorum warga</p>
                    <p className="text-xs font-semibold text-slate-600 tabular-nums">
                      {active.votesAgree} setuju · {active.votesDisagree} tolak
                    </p>
                  </div>
                  <Quorum
                    agree={active.votesAgree}
                    disagree={active.votesDisagree}
                    target={active.targetVotes}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {active.status !== 'menunggu'
                      ? 'Verifikasi untuk kiriman ini sudah selesai.'
                      : `Butuh ${Math.max(0, active.targetVotes - active.votesAgree)} suara setuju lagi untuk terverifikasi.`}
                  </p>
                </div>

                <VoteButtons id={active.id} check={canVote(active)} onVote={(c) => vote(active.id, c)} />
              </div>
            </div>
          </article>
        ) : (
          <article className="hidden flex-1 lg:block">
            <div className="grid h-full min-h-[16rem] place-items-center rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
              <div>
                <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-slate-100">
                  <Inbox className="size-6 text-slate-400" />
                </span>
                <p className="text-sm font-bold text-slate-800">Pilih kiriman</p>
                <p className="mt-1 text-xs text-slate-500">Detail akan tampil di panel ini.</p>
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className={cn('truncate text-slate-700', strong && 'font-semibold text-slate-900')}>{value}</dd>
    </div>
  );
}

function Quorum({
  agree,
  disagree,
  target,
  compact,
}: {
  agree: number;
  disagree: number;
  target: number;
  compact?: boolean;
}) {
  const total = Math.max(target, agree + disagree, 1);
  return (
    <div
      className={cn('flex gap-1', compact ? 'h-1 flex-1' : 'h-1.5 w-full')}
      role="img"
      aria-label={`${agree} setuju, ${disagree} tidak setuju, target ${target} suara`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'flex-1 rounded-full transition-colors',
            i < agree ? 'bg-ok-border' : i < agree + disagree ? 'bg-bad-border' : 'bg-slate-200',
          )}
        />
      ))}
    </div>
  );
}

function VoteButtons({
  id,
  check,
  onVote,
}: {
  id: string;
  check: { allowed: boolean; reason?: string };
  onVote: (c: 'setuju' | 'tidak_setuju') => void;
}) {
  return (
    <div className="space-y-2">
      {!check.allowed && check.reason && (
        <p
          role="alert"
          className="rounded-lg border border-wait-border bg-wait-bg px-2.5 py-2 text-xs leading-relaxed font-medium text-wait-text"
        >
          {check.reason}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          id={`agree-${id}`}
          disabled={!check.allowed}
          onClick={() => onVote('setuju')}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ok-border bg-ok-bg px-3 text-sm font-semibold text-ok-text transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ok-border focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
        >
          <ThumbsUp className="size-4 shrink-0" /> Setuju
        </button>
        <button
          id={`disagree-${id}`}
          disabled={!check.allowed}
          onClick={() => onVote('tidak_setuju')}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-bad-border bg-bad-bg px-3 text-sm font-semibold text-bad-text transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-bad-border focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
        >
          <ThumbsDown className="size-4 shrink-0" /> Tidak setuju
        </button>
      </div>
    </div>
  );
}

function Photo({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (err)
    return (
      <div className="flex aspect-[16/10] max-h-64 items-center justify-center gap-2 rounded-lg bg-slate-100 text-xs text-slate-500">
        <ImageOff className="size-4" /> Foto tidak dapat dimuat
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="aspect-[16/10] max-h-64 w-full rounded-lg border border-slate-100 bg-slate-50 object-cover"
    />
  );
}
