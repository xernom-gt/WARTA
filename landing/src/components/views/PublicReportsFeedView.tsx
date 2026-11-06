import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowLeft,
  Camera,
  ExternalLink,
  FilePlus2,
  ImageOff,
  ImagePlus,
  Inbox,
  MapPin,
  MessageSquarePlus,
  RotateCcw,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { WARTA_PROJECTS } from '../../data/wartaData';
import type { VerificationItem } from '../../types/warta';
import ExifCheckBadge from '../common/ExifCheckBadge';
import StatusBadge from '../common/StatusBadge';

type TypeFilter = 'semua' | 'laporan_kondisi' | 'klaim_lokasi';
type StatusFilter = 'semua' | 'menunggu' | 'terverifikasi' | 'diterima' | 'ditolak';
type SortKey = 'terbaru' | 'dukungan';

export default function PublicReportsFeedView() {
  const {
    queue,
    selectedReportId,
    selectReport,
    selectedProjectId,
    navigate,
    vote,
    canVote,
    currentUser,
    setLoginOpen,
    addEvidence,
    deleteEvidence,
  } = useWarta();

  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('semua');
  const [status, setStatus] = useState<StatusFilter>('semua');
  const [projectFilter, setProjectFilter] = useState<string>('semua');
  const [sort, setSort] = useState<SortKey>('terbaru');

  // Form tambah bukti pendukung (POST /reports/{report_id}/evidences)
  const [evDesc, setEvDesc] = useState('');
  const [evPhoto, setEvPhoto] = useState<string | undefined>(undefined);
  const [evError, setEvError] = useState('');

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = queue.filter((it) => {
      const matchTerm =
        !term ||
        [
          it.projectTitle,
          it.spseCode,
          it.authorDisplayName,
          it.narrative,
          it.proposedAddress,
          it.categoryLabel,
        ].some((v) => v.toLowerCase().includes(term));
      const matchType = type === 'semua' || it.itemType === type;
      const matchStatus = status === 'semua' || it.status === status;
      const matchProj = projectFilter === 'semua' || it.projectId === projectFilter;
      return matchTerm && matchType && matchStatus && matchProj;
    });
    if (sort === 'dukungan') return [...filtered].sort((a, b) => b.votesAgree - a.votesAgree);
    return filtered;
  }, [queue, q, type, status, projectFilter, sort]);

  const effectiveSelectedId =
    selectedReportId && list.some((it) => it.id === selectedReportId) ? selectedReportId : null;
  const active = list.find((it) => it.id === effectiveSelectedId) ?? list[0] ?? null;
  const mobileDetailOpen = effectiveSelectedId !== null;

  const resetFilters = () => {
    setQ('');
    setType('semua');
    setStatus('semua');
    setProjectFilter('semua');
    setSort('terbaru');
  };

  const onEvidencePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setEvPhoto(URL.createObjectURL(file));
    e.target.value = '';
  };

  const submitEvidence = (e: FormEvent, item: VerificationItem) => {
    e.preventDefault();
    setEvError('');
    if (!currentUser) {
      setLoginOpen(true);
      return;
    }
    if (evDesc.trim().length < 10) {
      setEvError('Keterangan bukti pendukung minimal 10 karakter.');
      return;
    }
    addEvidence(item.id, evDesc.trim(), evPhoto);
    setEvDesc('');
    setEvPhoto(undefined);
  };

  const selectClass =
    'rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header Halaman */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="max-w-2xl space-y-1">
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            Jelajah Aduan & Klaim Lokasi Warga
          </h1>
          <p className="text-sm leading-relaxed text-slate-600">
            Lihat laporan kondisi fisik dan klaim titik lokasi yang telah dikirim oleh pengadu lain. Anda dapat ikut memverifikasi kebenarannya atau menambahkan bukti foto pendukung di lapangan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('lapor', selectedProjectId ?? undefined)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
        >
          <Camera className="size-4" /> Buat Pengaduan Baru
        </button>
      </div>

      {/* Filter Bar */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
          <div className="relative md:col-span-5">
            <Search className="pointer-events-none absolute top-3 left-3.5 size-4 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama proyek, kode SPSE, isi aduan, atau nama pelapor…"
              className="w-full rounded-xl border border-slate-300 py-2 pr-3.5 pl-10 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
          </div>

          <select
            aria-label="Filter proyek"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className={`${selectClass} md:col-span-3`}
          >
            <option value="semua">Semua proyek ({WARTA_PROJECTS.length})</option>
            {WARTA_PROJECTS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter jenis kiriman"
            value={type}
            onChange={(e) => setType(e.target.value as TypeFilter)}
            className={`${selectClass} md:col-span-2`}
          >
            <option value="semua">Semua jenis</option>
            <option value="laporan_kondisi">Laporan kondisi</option>
            <option value="klaim_lokasi">Klaim lokasi</option>
          </select>

          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className={`${selectClass} md:col-span-2`}
          >
            <option value="semua">Semua status</option>
            <option value="menunggu">Menunggu (kuorum)</option>
            <option value="terverifikasi">Terverifikasi</option>
            <option value="diterima">Lokasi diterima</option>
            <option value="ditolak">Ditolak</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
          <span>
            Menampilkan <b className="tabular-nums text-slate-900">{list.length}</b> kiriman warga
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSort((s) => (s === 'terbaru' ? 'dukungan' : 'terbaru'))}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100"
            >
              Urutan: {sort === 'terbaru' ? 'Terbaru' : 'Dukungan terbanyak'}
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <RotateCcw className="size-3.5" /> Reset
            </button>
          </div>
        </div>
      </div>

      {/* Split Layout: Daftar Aduan (Kiri) + Detail & Tambah Bukti (Kanan) */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Daftar Kartu Aduan */}
        <section
          aria-label="Daftar aduan warga"
          className={`w-full lg:w-[44%] lg:shrink-0 ${mobileDetailOpen ? 'hidden lg:block' : 'block'}`}
        >
          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <span className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-slate-100">
                <Inbox className="size-6 text-slate-400" />
              </span>
              <p className="text-base font-bold text-slate-900">Tidak ada aduan yang cocok</p>
              <p className="mt-1 mb-4 text-xs text-slate-500">
                Ubah filter atau kata kunci pencarian untuk melihat kiriman warga lainnya.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {list.map((it) => {
                const isSelected = active?.id === it.id;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => selectReport(it.id)}
                      className={`w-full rounded-2xl border bg-white p-4 text-left transition ${
                        isSelected
                          ? 'border-brand ring-2 ring-brand/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {it.categoryLabel}
                        </span>
                        <StatusBadge status={it.status} size="sm" />
                      </div>

                      <h2 className="text-base font-bold leading-snug text-slate-900">
                        {it.projectTitle}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Oleh <span className="font-semibold text-slate-700">{it.authorDisplayName}</span> ·{' '}
                        {it.createdAt}
                      </p>

                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-700">
                        {it.narrative}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-xs text-slate-600">
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="size-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{it.proposedAddress}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-800">
                          {it.votesAgree}/{it.targetVotes} setuju · {(it.evidences ?? []).length} bukti
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Panel Detail Aduan, Voting & Bukti Pendukung */}
        {active && (
          <article
            aria-label="Detail aduan terpilih"
            className={`min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-20 ${
              mobileDetailOpen ? 'block' : 'hidden lg:block'
            }`}
          >
            {/* Bar Kembali untuk Layar Mobile */}
            <div className="border-b border-slate-100 px-4 py-2.5 lg:hidden">
              <button
                type="button"
                onClick={() => selectReport(null)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
              >
                <ArrowLeft className="size-4" /> Kembali ke daftar aduan
              </button>
            </div>

            {/* Header Detail Aduan */}
            <div className="border-b border-slate-200 p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    {active.itemType === 'klaim_lokasi' ? 'Klaim Lokasi Kanonik' : 'Laporan Kondisi Fisik'}
                  </span>
                  <span className="text-xs font-semibold text-brand">{active.categoryLabel}</span>
                </div>
                <StatusBadge status={active.status} />
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">
                    {active.projectTitle}
                  </h2>
                  <p className="mt-0.5 font-mono text-xs text-slate-500">
                    Kode SPSE #{active.spseCode} · Pagu {active.paguCompact}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('detail', active.projectId)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <ExternalLink className="size-3.5 text-brand" /> Detail Proyek SPSE
                </button>
              </div>
            </div>

            <div className="space-y-6 p-5">
              {/* Foto Lapangan & Pemeriksaan EXIF GPS */}
              <div className="space-y-3">
                <ReportPhoto src={active.photoUrl} alt={active.projectTitle} />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <ExifCheckBadge valid={active.exifValid} />
                  <span className="text-xs font-medium text-slate-600">
                    Jarak pengamatan: <b className="text-slate-900">{active.distanceFromProject}</b>
                  </span>
                </div>
              </div>

              {/* Narasi & Informasi Lokasi */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <span>
                    Dilaporkan oleh <b className="text-slate-800">{active.authorDisplayName}</b>
                  </span>
                  <span>{active.createdAt}</span>
                </div>
                <p className="text-base leading-relaxed text-slate-900">{active.narrative}</p>
                <div className="border-t border-slate-200/80 pt-2.5 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Lokasi pengamatan: </span>
                  {active.proposedAddress} ({active.coordinates.lat.toFixed(4)},{' '}
                  {active.coordinates.lng.toFixed(4)})
                </div>
              </div>

              {/* Verifikasi Silang Warga (Voting Kuorum 3 Suara) */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <Users className="size-4 text-brand" /> Verifikasi warga sekitar
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-slate-700">
                    {active.votesAgree} setuju · {active.votesDisagree} tidak setuju (target {active.targetVotes})
                  </span>
                </div>

                {/* Bar Kuorum */}
                <div className="mb-3 flex h-2 w-full gap-1">
                  {Array.from({ length: Math.max(active.targetVotes, active.votesAgree + active.votesDisagree, 1) }).map(
                    (_, i) => (
                      <span
                        key={i}
                        className={`flex-1 rounded-full ${
                          i < active.votesAgree
                            ? 'bg-ok-border'
                            : i < active.votesAgree + active.votesDisagree
                              ? 'bg-bad-border'
                              : 'bg-slate-200'
                        }`}
                      />
                    ),
                  )}
                </div>

                {(() => {
                  const check = canVote(active);
                  return (
                    <div className="space-y-2.5">
                      {!check.allowed && check.reason && (
                        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          {check.reason}
                        </p>
                      )}
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          disabled={!check.allowed}
                          onClick={() => vote(active.id, 'setuju')}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ok-border bg-ok-bg py-2.5 text-xs font-semibold text-ok-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
                        >
                          <ThumbsUp className="size-4" /> Setuju, Sesuai Lapangan
                        </button>
                        <button
                          type="button"
                          disabled={!check.allowed}
                          onClick={() => vote(active.id, 'tidak_setuju')}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-bad-border bg-bad-bg py-2.5 text-xs font-semibold text-bad-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45 sm:text-sm"
                        >
                          <ThumbsDown className="size-4" /> Tidak Sesuai
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Bukti Pendukung Warga Lain (GET & POST /reports/{report_id}/evidences) */}
              <div className="space-y-4 border-t border-slate-200 pt-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      <MessageSquarePlus className="size-4 text-brand" />
                      Bukti pendukung dari warga lain ({(active.evidences ?? []).length})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Warga lain dapat melampirkan foto atau catatan pengamatan tambahan pada aduan ini.
                    </p>
                  </div>
                </div>

                {(active.evidences ?? []).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 text-xs text-slate-500">
                    Belum ada bukti pendukung tambahan pada aduan ini.
                  </p>
                ) : (
                  <ul className="space-y-2.5">
                    {(active.evidences ?? []).map((ev) => (
                      <li
                        key={ev.id}
                        className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-800">{ev.authorDisplayName}</span>
                          <div className="flex items-center gap-2">
                            <span>{ev.createdAt}</span>
                            {currentUser === ev.authorDisplayName && active.status === 'menunggu' && (
                              <button
                                type="button"
                                onClick={() => deleteEvidence(active.id, ev.id)}
                                className="inline-flex items-center gap-1 text-bad-text hover:underline"
                                title="Hapus bukti pendukung (hanya saat laporan masih menunggu)"
                              >
                                <Trash2 className="size-3.5" /> Hapus
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="mt-1.5 text-sm text-slate-800">{ev.description}</p>
                        {ev.photoUrl && (
                          <img
                            src={ev.photoUrl}
                            alt="Foto bukti pendukung"
                            className="mt-2.5 max-h-40 rounded-lg border border-slate-200 object-cover"
                          />
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Form Tambah Bukti Pendukung */}
                <form
                  onSubmit={(e) => submitEvidence(e, active)}
                  className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  noValidate
                >
                  <p className="text-xs font-bold text-slate-800">
                    Tambahkan bukti pendukung baru pada aduan ini
                  </p>
                  <textarea
                    value={evDesc}
                    onChange={(e) => setEvDesc(e.target.value)}
                    rows={2}
                    placeholder="Tulis pengamatan tambahan Anda di lokasi yang sama (min. 10 karakter)…"
                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        <ImagePlus className="size-3.5 text-brand" />
                        {evPhoto ? 'Ganti foto bukti' : 'Lampirkan foto (opsional)'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={onEvidencePhoto}
                          className="sr-only"
                        />
                      </label>
                      {evPhoto && (
                        <span className="text-xs font-medium text-ok-text">1 foto siap dilampirkan</span>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
                    >
                      <FilePlus2 className="size-3.5" /> Kirim Bukti Pendukung
                    </button>
                  </div>

                  {evError && <p className="text-xs font-medium text-bad-text">{evError}</p>}
                </form>
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}

function ReportPhoto({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="flex aspect-16/10 max-h-64 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 text-xs text-slate-500">
        <ImageOff className="size-4" /> Foto lapangan tidak dapat dimuat
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="aspect-16/10 max-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 object-cover"
    />
  );
}
