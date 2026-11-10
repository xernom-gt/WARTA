import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  FilePlus2,
  History,
  ImageOff,
  Inbox,
  Loader2,
  Map,
  MapPin,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { DATASET_SUMMARY } from '../../data/wartaData';
import { cn } from '@/lib/utils';
import type { PrecisionLevel, VerificationItem, VoteChoice } from '../../types/warta';
import ExifCheckBadge from '../common/ExifCheckBadge';
import StatusBadge from '../common/StatusBadge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  verificationService,
  type ItemVoteDTO,
  type VerificationItemDTO,
} from '../../services/verification';

type TypeFilter = 'semua' | 'laporan_kondisi' | 'klaim_lokasi';
type StatusFilter = 'semua' | 'menunggu' | 'terverifikasi' | 'diterima' | 'ditolak';
type SortKey = 'default' | 'dukungan' | 'kontra';

const TYPE_LABEL: Record<VerificationItem['itemType'], string> = {
  laporan_kondisi: 'Laporan Kondisi',
  klaim_lokasi: 'Klaim Lokasi',
};

function dtoToItem(dto: VerificationItemDTO): VerificationItem {
  const isExifValid = dto.exif_status === 'valid';
  return {
    id: dto.id,
    projectId: dto.project_id,
    projectTitle: dto.project_title,
    spseCode: dto.spse_code,
    satker: dto.satker,
    paguCompact: dto.pagu_amount ? `Rp ${dto.pagu_amount}` : '-',
    itemType: dto.item_type,
    categoryLabel: dto.category_label || (dto.item_type === 'klaim_lokasi' ? 'Klaim Titik Lokasi' : 'Kondisi Proyek'),
    authorDisplayName: dto.author_display_name,
    createdAt: dto.created_at,
    distanceFromProject:
      dto.distance_from_project_m != null
        ? `${Math.round(dto.distance_from_project_m)}m dari proyek`
        : undefined,
    exifValid: isExifValid,
    exifNotice: dto.exif_notice ?? undefined,
    exifStatus: dto.exif_status,
    narrative: dto.narrative || '-',
    proposedAddress: dto.proposed_address || '-',
    proposedPrecision: (dto.proposed_precision as PrecisionLevel) || undefined,
    coordinates: {
      lat: dto.latitude ?? 0,
      lng: dto.longitude ?? 0,
    },
    photoUrl: dto.photo_url || '',
    votesAgree: dto.votes_agree,
    votesDisagree: dto.votes_disagree,
    targetVotes: dto.target_votes,
    voters: dto.voters ?? [],
    status: dto.status,
    reportId: dto.report_id,
    claimId: dto.claim_id,
  };
}

export default function VerificationQueueView() {
  const {
    queue,
    canVote,
    navigate,
    mapCondition,
    setMapCondition,
    setQueue,
    recordVote,
    currentUser,
  } = useWarta();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('semua');
  const [status, setStatus] = useState<StatusFilter>('semua');
  const [sort, setSort] = useState<SortKey>('default');

  const [loadingQueue, setLoadingQueue] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [votesHistory, setVotesHistory] = useState<ItemVoteDTO[]>([]);
  const [loadingVotes, setLoadingVotes] = useState(false);

  const [votingInProgress, setVotingInProgress] = useState(false);
  const [voteFeedback, setVoteFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoadingQueue(true);
    setLoadError(null);
    try {
      const res = await verificationService.getQueue({
        status: status !== 'semua' ? status : undefined,
        item_type: type !== 'semua' ? type : undefined,
        limit: 100,
      });
      if (res.data && res.data.length > 0) {
        const mapped = res.data.map(dtoToItem);
        setQueue(mapped);
      }
    } catch {
      // In case of local network error or mock mode fallback
      setLoadError('Gagal memuat antrean langsung dari API backend.');
    } finally {
      setLoadingQueue(false);
    }
  }, [status, type, setQueue]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const active = useMemo(() => {
    return activeId ? queue.find((it) => it.id === activeId) ?? null : null;
  }, [activeId, queue]);

  const fetchVotes = useCallback(async (itemId: string) => {
    setLoadingVotes(true);
    try {
      const res = await verificationService.getVotes(itemId);
      setVotesHistory(res.data ?? []);
    } catch {
      setVotesHistory([]);
    } finally {
      setLoadingVotes(false);
    }
  }, []);

  useEffect(() => {
    if (activeId) {
      setVoteFeedback(null);
      fetchVotes(activeId);
    } else {
      setVotesHistory([]);
    }
  }, [activeId, fetchVotes]);

  const handleCastVote = async (choice: VoteChoice) => {
    if (!active || votingInProgress) return;
    setVotingInProgress(true);
    setVoteFeedback(null);

    try {
      const res = await verificationService.castVote(active.id, choice);
      const isAgree = choice === 'setuju';
      const updatedItem: VerificationItem = {
        ...active,
        votesAgree: res.resolution.votes_agree,
        votesDisagree: res.resolution.votes_disagree,
        status: res.resolution.status as VerificationItem['status'],
        voters: [...active.voters, currentUser ?? 'Warga'],
      };

      recordVote(
        {
          itemId: active.id,
          projectId: active.projectId,
          projectTitle: active.projectTitle,
          itemType: active.itemType,
          authorDisplayName: active.authorDisplayName,
          choice,
          votedAt: 'Baru saja',
        },
        updatedItem,
      );

      setVoteFeedback({
        type: 'ok',
        text: `Suara "${isAgree ? 'Setuju' : 'Tidak Setuju'}" berhasil dicatat dalam konsensus warga.`,
      });
      fetchVotes(active.id);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } } } };
      const msg = e.response?.data?.error?.message ?? 'Gagal mengirim suara ke server.';
      setVoteFeedback({ type: 'err', text: msg });
    } finally {
      setVotingInProgress(false);
    }
  };

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = queue.filter((it) => {
      const matchTerm =
        !term ||
        [it.projectTitle, it.spseCode, it.authorDisplayName, it.satker, it.categoryLabel, it.narrative].some((v) =>
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
  const verifiedCount = queue.filter((it) => it.status === 'terverifikasi' || it.status === 'diterima').length;
  const filterActive = type !== 'semua' || status !== 'semua' || sort !== 'default' || q.trim() !== '';

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const resetFilter = () => {
    setQ('');
    setType('semua');
    setStatus('semua');
    setSort('default');
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-10 sm:px-6 sm:py-12">
      <section className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end">
        <div className="max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Aduan & Verifikasi Warga
            </h1>
            <button
              onClick={fetchQueue}
              title="Perbarui antrean"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-brand transition"
            >
              <RefreshCw className={cn('size-5', loadingQueue && 'animate-spin text-brand')} />
            </button>
          </div>
          <p className="text-base leading-relaxed text-slate-600">
            Pantau laporan kondisi fisik dan klaim lokasi proyek pemerintah secara terbuka. Setiap aduan diverifikasi bersama melalui kuorum 3 suara warga.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            id="cta-create-report"
            onClick={() => navigate('lapor')}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-bold text-white shadow-xs transition hover:bg-brand-dark"
          >
            <FilePlus2 className="size-5 shrink-0" />
            + Buat Pengaduan
          </button>
          <button
            id="cta-open-map"
            onClick={() => navigate('peta')}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            <Map className="size-5 shrink-0 text-brand" />
            Proyek & Peta
          </button>
        </div>
      </section>

      <section aria-label="Ringkasan transparansi aduan" className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div className="border-l-2 border-brand pl-4">
          <p className="text-3xl font-black text-slate-900 tabular-nums">{queue.length}</p>
          <p className="mt-1 text-sm font-medium text-slate-600">Total Aduan Masuk</p>
        </div>
        <div className="border-l-2 border-wait-border pl-4">
          <p className="text-3xl font-black text-wait-text tabular-nums">{pendingCount}</p>
          <p className="mt-1 text-sm font-medium text-slate-600">Menunggu Kuorum (3 Suara)</p>
        </div>
        <div className="border-l-2 border-ok-border pl-4">
          <p className="text-3xl font-black text-ok-text tabular-nums">{verifiedCount}</p>
          <p className="mt-1 text-sm font-medium text-slate-600">Terverifikasi Warga</p>
        </div>
        <div className="border-l-2 border-slate-300 pl-4">
          <p className="text-3xl font-black text-slate-900 tabular-nums">{DATASET_SUMMARY.uniqueProjects}</p>
          <p className="mt-1 text-sm font-medium text-slate-600">Paket Proyek SPSE</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-slate-300 bg-slate-50/60 px-3.5 transition-colors focus-within:border-action-border focus-within:bg-white focus-within:ring-2 focus-within:ring-action-border/30">
            <Search className="size-4 shrink-0 text-slate-500" />
            <input
              id="verify-search"
              aria-label="Cari aduan warga"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama proyek, isi laporan, kode tender, atau pelapor…"
              className="w-full min-w-0 bg-transparent py-2.5 text-base text-slate-900 outline-none placeholder:text-slate-500"
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:items-center">
            <Select value={type} onValueChange={(v) => setType(v as TypeFilter)}>
              <SelectTrigger id="verify-type" aria-label="Filter jenis kiriman" className="h-11 sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua jenis</SelectItem>
                <SelectItem value="laporan_kondisi">Laporan kondisi</SelectItem>
                <SelectItem value="klaim_lokasi">Klaim lokasi</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger id="verify-status" aria-label="Filter status verifikasi" className="h-11 sm:w-44">
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
              <SelectTrigger id="verify-sort" aria-label="Urutkan daftar aduan" className="h-11 sm:w-48">
                <span className="flex min-w-0 items-center gap-2">
                  <ArrowUpDown className="size-4 shrink-0 text-slate-500" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Terbaru</SelectItem>
                <SelectItem value="dukungan">Dukungan terbanyak</SelectItem>
                <SelectItem value="kontra">Penolakan terbanyak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {filterActive && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-600">
            <span>
              Menampilkan <b className="font-semibold text-slate-900 tabular-nums">{list.length}</b> dari{' '}
              <span className="tabular-nums">{queue.length}</span> kiriman warga
            </span>
            <button
              id="verify-reset"
              onClick={resetFilter}
              className="font-semibold text-action-border underline-offset-2 hover:underline"
            >
              Reset filter
            </button>
          </div>
        )}
      </section>

      {mapCondition === 'loading' || loadingQueue ? (
        <div
          role="status"
          className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center"
        >
          <Loader2 className="mb-3 size-8 animate-spin text-brand" />
          <p className="text-base font-bold text-slate-900">Memuat antrean verifikasi…</p>
          <p className="mt-1 text-sm text-slate-600">Menyinkronkan kiriman terbaru dari antrean publik.</p>
        </div>
      ) : mapCondition === 'tile-error' || loadError ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-2xl border border-bad-border bg-bad-bg px-6 py-12 text-center text-bad-text"
        >
          <AlertTriangle className="mb-3 size-8" />
          <p className="text-base font-bold">Gagal memuat antrean verifikasi</p>
          <p className="mt-1 max-w-md text-sm">
            {loadError || 'Terjadi gangguan saat mengambil data kiriman warga.'}
          </p>
          <button
            onClick={() => {
              setLoadError(null);
              setMapCondition('normal');
              fetchQueue();
            }}
            className="mt-4 rounded-xl bg-bad-text px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Coba Muat Ulang
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mb-4 grid size-14 place-items-center rounded-full bg-slate-100 text-slate-600">
            <Inbox className="size-7" />
          </span>
          <h2 className="text-lg font-bold text-slate-900">
            {queue.length === 0 ? 'Belum ada aduan warga yang masuk' : 'Tidak ada kiriman yang cocok'}
          </h2>
          <p className="mt-2 max-w-md text-base leading-relaxed text-slate-600">
            {queue.length === 0
              ? 'Jadilah warga pertama yang mengirim laporan kondisi fisik atau klaim titik lokasi proyek di sekitar tempat tinggal Anda.'
              : 'Longgarkan kata kunci pencarian atau atur ulang filter jenis dan status di atas.'}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {filterActive ? (
              <button
                onClick={resetFilter}
                className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Reset Filter
              </button>
            ) : (
              <button
                onClick={() => navigate('lapor')}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-bold text-white hover:bg-brand-dark"
              >
                <FilePlus2 className="size-5" />
                + Buat Pengaduan Pertama
              </button>
            )}
          </div>
        </div>
      ) : (
        <ul className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {list.map((it) => (
            <li key={it.id} className="flex">
              <article className="group flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition hover:border-slate-300 hover:shadow-md">
                <button
                  id={`queue-${it.id}`}
                  type="button"
                  onClick={() => setActiveId(it.id)}
                  className="flex flex-1 flex-col text-left focus-visible:outline-none"
                >
                  <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-100">
                    <CardPhoto src={it.photoUrl} alt={`Foto lapangan ${it.projectTitle}`} />
                    <div className="absolute top-3 left-3">
                      <StatusBadge status={it.status} />
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-4 p-6">
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                          {TYPE_LABEL[it.itemType]}
                        </span>
                        <span>·</span>
                        <span>{it.categoryLabel}</span>
                      </div>

                      <h2 className="line-clamp-2 text-lg leading-snug font-bold text-slate-900 group-hover:text-brand">
                        {it.projectTitle}
                      </h2>

                      <p className="line-clamp-3 text-base leading-relaxed text-slate-700">
                        {it.narrative}
                      </p>
                    </div>

                    <div className="space-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
                      <p className="flex items-center gap-1.5 truncate">
                        <MapPin className="size-4 shrink-0 text-brand" />
                        <span className="truncate">{it.proposedAddress}</span>
                      </p>

                      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                        <span className="flex items-center gap-1.5 font-medium text-slate-700">
                          <UserRound className="size-3.5 text-slate-500" />
                          {it.authorDisplayName}
                        </span>
                        <span>{it.createdAt}</span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                          <span>Kuorum Verifikasi</span>
                          <span className="tabular-nums">
                            {it.votesAgree}/{it.targetVotes} setuju
                          </span>
                        </div>
                        <Quorum
                          agree={it.votesAgree}
                          disagree={it.votesDisagree}
                          target={it.targetVotes}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                </button>
              </article>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="verify-detail-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-0 sm:items-center sm:p-4"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={active.status} />
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                    {TYPE_LABEL[active.itemType]}
                  </span>
                  <span className="text-xs font-medium text-slate-600">{active.categoryLabel}</span>
                </div>
                <h2 id="verify-detail-title" className="text-xl leading-snug font-extrabold text-slate-900">
                  {active.projectTitle}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600">
                  Kode Tender <span className="font-mono font-semibold">#{active.spseCode}</span> · {active.satker}
                </p>
              </div>
              <button
                onClick={() => setActiveId(null)}
                aria-label="Tutup detail aduan"
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <ModalPhoto src={active.photoUrl} alt={`Foto bukti ${active.projectTitle}`} />

              <dl className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-slate-600">Pelapor</dt>
                  <dd className="mt-0.5 font-bold text-slate-900">{active.authorDisplayName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-slate-600">Waktu Kirim</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{active.createdAt}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold text-slate-600">Lokasi Terlapor</dt>
                  <dd className="mt-0.5 flex items-start gap-1.5 text-slate-800">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-brand" />
                    <span>
                      {active.proposedAddress}
                      {active.distanceFromProject ? ` (${active.distanceFromProject})` : ''}
                    </span>
                  </dd>
                </div>
              </dl>

              {/* Badge Validitas GPS EXIF */}
              <ExifCheckBadge
                valid={active.exifValid}
                status={active.exifStatus}
                notice={active.exifNotice}
              />

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-slate-900">Catatan Lapangan Warga</h3>
                <p className="rounded-xl border border-slate-200 bg-white p-4 text-base leading-relaxed text-slate-800">
                  {active.narrative}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">Kuorum Verifikasi Warga</p>
                  <p className="text-xs font-semibold text-slate-700 tabular-nums">
                    {active.votesAgree} setuju · {active.votesDisagree} tidak setuju (target {active.targetVotes})
                  </p>
                </div>
                <Quorum
                  agree={active.votesAgree}
                  disagree={active.votesDisagree}
                  target={active.targetVotes}
                />
                <p className="mt-2 text-xs text-slate-600">
                  {active.status !== 'menunggu'
                    ? 'Verifikasi untuk kiriman ini sudah selesai.'
                    : `Butuh ${Math.max(0, active.targetVotes - active.votesAgree)} suara setuju lagi agar berstatus Terverifikasi.`}
                </p>
              </div>

              {voteFeedback && (
                <div
                  className={cn(
                    'flex items-center gap-2 rounded-xl p-3 text-xs font-semibold',
                    voteFeedback.type === 'ok'
                      ? 'border border-ok-border bg-ok-bg text-ok-text'
                      : 'border border-bad-border bg-bad-bg text-bad-text',
                  )}
                >
                  {voteFeedback.type === 'ok' ? (
                    <CheckCircle2 className="size-4 shrink-0" />
                  ) : (
                    <AlertCircle className="size-4 shrink-0" />
                  )}
                  <span>{voteFeedback.text}</span>
                </div>
              )}

              {/* Tombol voting Setuju / Tidak Setuju */}
              <VoteButtons
                id={active.id}
                check={canVote(active)}
                loading={votingInProgress}
                onVote={handleCastVote}
              />

              {/* Riwayat Suara Pemilih */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="size-4 text-slate-600" />
                    <h4 className="text-sm font-bold text-slate-900">Riwayat Suara Pemilih</h4>
                  </div>
                  {loadingVotes && <Loader2 className="size-3.5 animate-spin text-brand" />}
                </div>

                {votesHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {loadingVotes ? 'Memuat riwayat suara…' : 'Belum ada suara pemilih yang tercatat.'}
                  </p>
                ) : (
                  <ul className="space-y-2 text-xs">
                    {votesHistory.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                      >
                        <span className="font-mono text-slate-700">Warga #{v.user_id.slice(0, 8)}</span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold',
                              v.choice === 'setuju'
                                ? 'bg-ok-bg text-ok-text'
                                : 'bg-bad-bg text-bad-text',
                            )}
                          >
                            {v.choice === 'setuju' ? (
                              <ThumbsUp className="size-3" />
                            ) : (
                              <ThumbsDown className="size-3" />
                            )}
                            {v.choice === 'setuju' ? 'Setuju' : 'Tidak Setuju'}
                          </span>
                          <span className="text-slate-400">{v.created_at}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
      className={cn('flex gap-1.5', compact ? 'h-1.5 w-full' : 'h-2 w-full')}
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
  loading,
  onVote,
}: {
  id: string;
  check: { allowed: boolean; reason?: string };
  loading?: boolean;
  onVote: (c: 'setuju' | 'tidak_setuju') => void;
}) {
  return (
    <div className="space-y-3">
      {!check.allowed && check.reason && (
        <p
          role="alert"
          className="rounded-xl border border-wait-border bg-wait-bg px-3.5 py-2.5 text-sm leading-relaxed font-medium text-wait-text"
        >
          {check.reason}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          id={`agree-${id}`}
          disabled={!check.allowed || loading}
          onClick={() => onVote('setuju')}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-ok-border bg-ok-bg px-4 text-sm font-bold text-ok-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4 shrink-0" />}
          Setuju (Sesuai Lapangan)
        </button>
        <button
          id={`disagree-${id}`}
          disabled={!check.allowed || loading}
          onClick={() => onVote('tidak_setuju')}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-bad-border bg-bad-bg px-4 text-sm font-bold text-bad-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <ThumbsDown className="size-4 shrink-0" />}
          Tidak Setuju
        </button>
      </div>
    </div>
  );
}

function CardPhoto({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (err || !src)
    return (
      <div className="flex h-full w-full items-center justify-center gap-2 bg-slate-100 text-xs text-slate-600">
        <ImageOff className="size-4" /> Foto tidak dapat dimuat
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
    />
  );
}

function ModalPhoto({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (err || !src)
    return (
      <div className="flex aspect-16/10 max-h-72 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm text-slate-600">
        <ImageOff className="size-4" /> Foto tidak dapat dimuat
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="aspect-16/10 max-h-80 w-full rounded-xl border border-slate-200 bg-slate-50 object-cover"
    />
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
      className={cn('flex gap-1.5', compact ? 'h-1.5 w-full' : 'h-2 w-full')}
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
    <div className="space-y-3">
      {!check.allowed && check.reason && (
        <p
          role="alert"
          className="rounded-xl border border-wait-border bg-wait-bg px-3.5 py-2.5 text-sm leading-relaxed font-medium text-wait-text"
        >
          {check.reason}
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          id={`agree-${id}`}
          disabled={!check.allowed}
          onClick={() => onVote('setuju')}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-ok-border bg-ok-bg px-4 text-sm font-bold text-ok-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
        >
          <ThumbsUp className="size-4 shrink-0" /> Setuju (Sesuai Lapangan)
        </button>
        <button
          id={`disagree-${id}`}
          disabled={!check.allowed}
          onClick={() => onVote('tidak_setuju')}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-bad-border bg-bad-bg px-4 text-sm font-bold text-bad-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100"
        >
          <ThumbsDown className="size-4 shrink-0" /> Tidak Setuju
        </button>
      </div>
    </div>
  );
}

function CardPhoto({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (err)
    return (
      <div className="flex h-full w-full items-center justify-center gap-2 bg-slate-100 text-xs text-slate-600">
        <ImageOff className="size-4" /> Foto tidak dapat dimuat
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
    />
  );
}

function ModalPhoto({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (err)
    return (
      <div className="flex aspect-16/10 max-h-72 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm text-slate-600">
        <ImageOff className="size-4" /> Foto tidak dapat dimuat
      </div>
    );
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="aspect-16/10 max-h-80 w-full rounded-xl border border-slate-200 bg-slate-50 object-cover"
    />
  );
}
