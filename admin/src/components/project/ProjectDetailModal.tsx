import { useEffect } from 'react';
import { Building2, Camera, Database, MapPinned, Users, X } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { getProject } from '../../data/wartaData';
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
      className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-title"
    >
      <div className="max-h-[92vh] w-full max-w-3xl animate-slide-up overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-slate-200 bg-white px-6 py-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={p.status} size="md" />
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {p.category}
              </span>
            </div>
            <h2 id="detail-title" className="text-xl font-extrabold text-slate-900 sm:text-2xl">
              {p.title}
            </h2>
            <p className="mt-0.5 font-mono text-sm text-slate-600">Kode tender #{p.spseCode}</p>
          </div>
          <button
            id="detail-close"
            onClick={() => navigate('peta')}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Tutup detail"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-8 p-6 sm:p-8">
          <p className="flex items-start gap-2.5 text-base font-medium text-slate-800">
            <Building2 className="mt-0.5 size-5 shrink-0 text-brand" />
            {p.satker}
          </p>

          {/* Anggaran */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">Rincian Anggaran</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Money label="Pagu Anggaran" value={money(p.paguCompact, p.paguFull)} strong />
              <Money label="Nilai HPS" value={money(p.hpsCompact, p.hpsFull)} />
              {p.kontrakAvailable && p.kontrakCompact && p.kontrakFull ? (
                <Money label="Nilai Kontrak" value={money(p.kontrakCompact, p.kontrakFull)} />
              ) : (
                <div className="rounded-xl border border-dashed border-draft-border bg-draft-bg p-4">
                  <p className="text-xs font-semibold text-slate-600">Nilai Kontrak</p>
                  <p className="mt-1 text-sm font-medium text-draft-text">{NO_CONTRACT}</p>
                </div>
              )}
            </div>
          </section>

          {/* Tahun */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">Tahun Anggaran</h3>
            <div className="flex flex-wrap gap-2">
              {p.years.map((y) => (
                <span
                  key={y}
                  className="rounded-full border border-action-border bg-action-bg px-3.5 py-1 text-sm font-semibold text-action-text"
                >
                  APBD {y}
                </span>
              ))}
            </div>
            {p.multiYearsMicrocopy && <p className="text-sm text-slate-600">{p.multiYearsMicrocopy}</p>}
          </section>

          {/* Lokasi */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">Lokasi & Presisi</h3>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
              <p className="flex items-start gap-2 text-base font-semibold text-slate-900">
                <MapPinned className="mt-0.5 size-5 shrink-0 text-brand" />
                {p.locationDesc}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {p.precisionBadge}
                </span>
                <span
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    p.locationSource === 'warga'
                      ? 'bg-ok-bg text-ok-text'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200'
                  }`}
                >
                  Sumber: {p.locationSource === 'warga' ? 'Warga' : 'SPSE'}
                </span>
              </div>
              {p.precisionMicrocopy && <p className="text-slate-600">{p.precisionMicrocopy}</p>}
              {p.precisionResolutionNote && (
                <p className="rounded-lg bg-action-bg p-3 text-action-text">{p.precisionResolutionNote}</p>
              )}
              {p.canonicalMicrocopy && (
                <p className="rounded-lg bg-ok-bg p-3 font-medium text-ok-text">{p.canonicalMicrocopy}</p>
              )}
            </div>
            {p.subLocations && (
              <div className="pt-2">
                <SubLocationTabs locations={p.subLocations} microcopy={p.subLocationsMicrocopy} />
              </div>
            )}
          </section>

          {/* Risiko */}
          <section className="space-y-3">
            <h3 className="text-base font-bold text-slate-900">Indikator Risiko Kontrak</h3>
            <ContractRiskBadges flags={p.riskFlags} />
          </section>

          {p.isRetender && p.retenderMicrocopy && (
            <TenderHistoryAccordion title={p.retenderMicrocopy} tenders={p.failedTenders} currentCode={p.spseCode} />
          )}

          {/* Laporan */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Users className="size-5 text-brand" /> Laporan Warga ({reports.length})
            </h3>
            {reports.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                Belum ada laporan warga di antrean untuk paket proyek ini.
              </p>
            ) : (
              <ul className="space-y-3">
                {reports.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm"
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900">{r.categoryLabel}</p>
                      <p className="leading-relaxed text-slate-700">{r.narrative}</p>
                      <p className="text-xs text-slate-600">
                        {r.authorDisplayName} · {r.createdAt}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
          <p className="mb-3 flex items-center gap-1.5 text-xs text-slate-600">
            <Database className="size-3.5" />
            {p.sourceNote}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              id="detail-report"
              onClick={() => navigate('lapor', p.id)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-3 text-base font-bold text-white transition hover:bg-brand-dark"
            >
              <Camera className="size-5" /> Laporkan Kondisi Proyek
            </button>
            <button
              id="detail-claim"
              onClick={() => navigate('klaim', p.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl border-2 py-3 text-base font-semibold transition ${
                p.isRoughArea && !p.isCanonicalClaimed
                  ? 'border-action-border bg-action-bg text-action-text hover:bg-sky-100'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <MapPinned className="size-5" /> Klaim Titik Lokasi
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
      className={`rounded-xl border p-4 ${
        strong ? 'border-brand bg-brand text-white' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className={`text-xs font-semibold ${strong ? 'text-sky-100' : 'text-slate-600'}`}>{label}</p>
      <p className="mt-1 break-words text-lg font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
