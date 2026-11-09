import { useEffect } from 'react';
import {
  ArrowRight,
  Building2,
  Camera,
  Database,
  FilePlus2,
  MapPinned,
  MessageSquareText,
  X,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { getProject } from '../../data/wartaData';
import ExifCheckBadge from '../common/ExifCheckBadge';
import StatusBadge from '../common/StatusBadge';
import ContractRiskBadges from './ContractRiskBadges';
import SubLocationTabs from './SubLocationTabs';
import TenderHistoryAccordion from './TenderHistoryAccordion';

const NO_CONTRACT = 'Nilai kontrak belum tersedia di sumber publik.';

export default function ProjectDetailModal() {
  const { activeScreen, selectedProjectId, navigate, compactRupiah, queue } = useWarta();

  useEffect(() => {
    if (activeScreen !== 'detail') return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && navigate('peta');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeScreen, navigate]);

  if (activeScreen !== 'detail' || !selectedProjectId) return null;
  const p = getProject(selectedProjectId);
  const reports = queue.filter((q) => q.projectId === p.id);
  const money = (c: string, f: string) => (compactRupiah ? c : f);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="detail-title"
    >
      <div className="max-h-[92vh] w-full max-w-3xl animate-slide-up overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur-xs sm:px-8">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={p.status} size="md" />
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {p.category}
              </span>
            </div>
            <h2 id="detail-title" className="text-xl font-extrabold text-slate-900 sm:text-2xl">
              {p.title}
            </h2>
            <p className="font-mono text-sm text-slate-600">Kode tender SPSE #{p.spseCode}</p>
          </div>
          <button
            type="button"
            id="detail-close"
            onClick={() => navigate('peta')}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Tutup detail"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          <p className="flex items-start gap-2.5 text-base text-slate-700">
            <Building2 className="mt-1 size-5 shrink-0 text-brand" aria-hidden="true" />
            <span>{p.satker}</span>
          </p>

          {/* Anggaran */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">Ringkasan Anggaran</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Money label="Nilai Pagu" value={money(p.paguCompact, p.paguFull)} strong />
              <Money label="Nilai HPS" value={money(p.hpsCompact, p.hpsFull)} />
              {p.kontrakAvailable && p.kontrakCompact && p.kontrakFull ? (
                <Money label="Nilai Kontrak" value={money(p.kontrakCompact, p.kontrakFull)} />
              ) : (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-600">Nilai Kontrak</p>
                  <p className="mt-1 text-sm font-medium text-slate-700">{NO_CONTRACT}</p>
                </div>
              )}
            </div>
          </section>

          {/* Tahun Anggaran */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-slate-900">Tahun Pendanaan</h3>
            <div className="flex flex-wrap gap-2">
              {p.years.map((y) => (
                <span
                  key={y}
                  className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold tabular-nums text-slate-800"
                >
                  APBD {y}
                </span>
              ))}
            </div>
            {p.multiYearsMicrocopy && (
              <p className="text-sm text-slate-600">{p.multiYearsMicrocopy}</p>
            )}
          </section>

          {/* Lokasi */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">Data Lokasi Paket</h3>
            <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
              <p className="flex items-start gap-2 text-base font-medium text-slate-900">
                <MapPinned className="mt-1 size-4 shrink-0 text-brand" aria-hidden="true" />
                {p.locationDesc}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {p.precisionBadge}
                </span>
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    p.locationSource === 'warga'
                      ? 'bg-ok-bg text-ok-text'
                      : 'bg-white text-slate-700'
                  }`}
                >
                  Sumber: {p.locationSource === 'warga' ? 'Warga' : 'SPSE'}
                </span>
              </div>
              {p.precisionMicrocopy && (
                <p className="text-sm text-slate-600">{p.precisionMicrocopy}</p>
              )}
              {p.precisionResolutionNote && (
                <p className="rounded-lg bg-action-bg p-3 text-sm text-action-text">
                  {p.precisionResolutionNote}
                </p>
              )}
              {p.canonicalMicrocopy && (
                <p className="rounded-lg bg-ok-bg p-3 text-sm font-medium text-ok-text">
                  {p.canonicalMicrocopy}
                </p>
              )}
            </div>
            {p.subLocations && (
              <div className="pt-1">
                <SubLocationTabs locations={p.subLocations} microcopy={p.subLocationsMicrocopy} />
              </div>
            )}
          </section>

          {/* Risiko */}
          <section className="space-y-2.5">
            <h3 className="text-base font-bold text-slate-900">Catatan & Indikator Kontrak</h3>
            <ContractRiskBadges flags={p.riskFlags} />
          </section>

          {p.isRetender && p.retenderMicrocopy && (
            <TenderHistoryAccordion
              title={p.retenderMicrocopy}
              tenders={p.failedTenders}
              currentCode={p.spseCode}
            />
          )}

          {/* Aduan Warga pada Paket Ini */}
          <section className="space-y-3 border-t border-slate-200 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
                <MessageSquareText className="size-5 text-brand" aria-hidden="true" />
                Aduan & Klaim Warga pada Proyek Ini ({reports.length})
              </h3>
              {reports.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('aduan', p.id, reports[0].id)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                >
                  Buka di Feed Aduan Warga <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>

            {reports.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                Belum ada aduan warga untuk paket ini. Jadilah warga pertama yang melaporkan kondisi lapangan.
              </div>
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 text-sm transition hover:border-slate-300"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">{r.categoryLabel}</p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          Oleh <span className="font-semibold text-slate-800">{r.authorDisplayName}</span> ·{' '}
                          {r.createdAt}
                          {r.distanceFromProject ? ` · ${r.distanceFromProject}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    <p className="mt-2.5 text-base leading-relaxed text-slate-800">{r.narrative}</p>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {typeof r.exifValid === 'boolean' && <ExifCheckBadge valid={r.exifValid} />}
                        <span className="text-sm font-medium tabular-nums text-slate-600">
                          {r.votesAgree}/{r.targetVotes} suara setuju · {(r.evidences ?? []).length} bukti
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('aduan', p.id, r.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand/10"
                      >
                        <FilePlus2 className="size-4" aria-hidden="true" /> Detail & Tambah Bukti
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-xs sm:px-8">
          <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-600">
            <Database className="size-3.5" aria-hidden="true" />
            {p.sourceNote}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              id="detail-report"
              onClick={() => navigate('lapor', p.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 text-base font-semibold text-white transition hover:bg-brand-dark"
            >
              <Camera className="size-4" aria-hidden="true" /> Buat Pengaduan Kondisi
            </button>
            <button
              type="button"
              id="detail-claim"
              onClick={() => navigate('klaim', p.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-base font-semibold transition ${
                p.isRoughArea && !p.isCanonicalClaimed
                  ? 'border-action-border bg-action-bg text-action-text hover:bg-sky-100'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <MapPinned className="size-4" aria-hidden="true" /> Usulkan Titik Lokasi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Money({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`rounded-xl p-4 ${
        strong ? 'bg-brand text-white' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <p className={`text-xs font-semibold ${strong ? 'text-sky-200' : 'text-slate-600'}`}>{label}</p>
      <p className="mt-1 break-words text-lg font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
