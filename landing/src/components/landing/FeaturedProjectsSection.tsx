import { useState } from 'react';
import { Building2, Database, MapPinned, RefreshCw, X } from 'lucide-react';
import { WARTA_PROJECTS } from '../../data/wartaData';
import type { ProjectPackage } from '../../types/warta';
import StatusBadge from '../common/StatusBadge';
import ContractRiskBadges from '../project/ContractRiskBadges';
import SubLocationTabs from '../project/SubLocationTabs';
import TenderHistoryAccordion from '../project/TenderHistoryAccordion';

export default function FeaturedProjectsSection() {
  const [compact, setCompact] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'retender' | 'multi' | 'no-contract'>('all');
  const [selected, setSelected] = useState<ProjectPackage | null>(null);

  const list = WARTA_PROJECTS.filter((p) => {
    if (filterMode === 'retender') return p.isRetender;
    if (filterMode === 'multi') return Boolean(p.subLocations?.length) || p.years.length > 1;
    if (filterMode === 'no-contract') return !p.kontrakAvailable;
    return true;
  });

  return (
    <section id="katalog-proyek" className="mx-auto max-w-7xl px-4 py-14">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <span className="inline-block rounded-full bg-action-bg px-3 py-1 text-xs font-bold uppercase tracking-wider text-action-text">
            Data Nyata SPSE / INAPROC
          </span>
          <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
            8 Sampel Paket Konstruksi Kanonik DKI Jakarta & Sekitarnya
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Seluruh angka Pagu, HPS, Nilai Kontrak, dan tahun APBD bersumber langsung dari dataset SPSE tanpa dikarang.
            Klik salah satu paket untuk melihat detail risiko kontrak dan riwayat tender.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCompact((v) => !v)}
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Format Anggaran: {compact ? 'Ringkas (Rp516,02 miliar)' : 'Lengkap (Rp516.020.000.000)'}
        </button>
      </div>

      {/* Filter Cepat */}
      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'Semua Paket (8)' },
          { id: 'retender', label: 'Tender Ulang / Riwayat Gagal (3)' },
          { id: 'multi', label: 'Multi-Tahun / Multi-Lokasi (4)' },
          { id: 'no-contract', label: 'Kontrak Belum Tersedia (3)' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilterMode(f.id as typeof filterMode)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
              filterMode === f.id
                ? 'border-brand bg-brand text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-brand'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid Kartu Proyek */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((p) => (
          <article
            key={p.id}
            onClick={() => setSelected(p)}
            className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-action-border hover:shadow-lg"
          >
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={p.status} />
                {p.isRetender && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-wait-bg px-2 py-0.5 text-[11px] font-semibold text-wait-text">
                    <RefreshCw className="size-3" /> Tender Ulang
                  </span>
                )}
              </div>

              <h3 className="font-extrabold leading-snug text-slate-900 group-hover:text-brand">{p.title}</h3>
              <p className="font-mono text-xs text-slate-500">#{p.spseCode} • {p.city}</p>

              <div className="mt-3 rounded-xl bg-slate-50 p-2.5">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">Pagu Anggaran</p>
                <p className="text-base font-black text-brand">{compact ? p.paguCompact : p.paguFull}</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Kontrak:{' '}
                  <b>
                    {p.kontrakAvailable && p.kontrakCompact && p.kontrakFull
                      ? compact
                        ? p.kontrakCompact
                        : p.kontrakFull
                      : 'Belum tersedia di sumber publik'}
                  </b>
                </p>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-100 pt-2.5">
              <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                {p.precisionBadge}
              </span>
              <p className="mt-1.5 text-xs font-bold text-action-border group-hover:underline">
                Lihat Detail & Riwayat Tender →
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* Modal Pratinjau Detail Paket */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal
        >
          <div className="max-h-[90vh] w-full max-w-2xl animate-slide-up overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <StatusBadge status={selected.status} size="md" />
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                    {selected.category}
                  </span>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900">{selected.title}</h3>
                <p className="font-mono text-xs text-slate-500">Kode Tender #{selected.spseCode}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full p-1.5 hover:bg-slate-100"
                aria-label="Tutup"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <p className="flex items-start gap-2 text-slate-700">
                <Building2 className="mt-0.5 size-4 shrink-0 text-brand" />
                {selected.satker}
              </p>

              <div className="grid gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl bg-brand p-3 text-white">
                  <p className="text-xs text-sky-200">Pagu</p>
                  <p className="font-extrabold">{compact ? selected.paguCompact : selected.paguFull}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">HPS</p>
                  <p className="font-extrabold">{compact ? selected.hpsCompact : selected.hpsFull}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Nilai Kontrak</p>
                  <p className="font-bold">
                    {selected.kontrakAvailable && selected.kontrakCompact && selected.kontrakFull
                      ? compact
                        ? selected.kontrakCompact
                        : selected.kontrakFull
                      : 'Nilai kontrak belum tersedia di sumber publik.'}
                  </p>
                </div>
              </div>

              {selected.multiYearsMicrocopy && (
                <p className="rounded-xl bg-action-bg px-3 py-2 text-xs font-semibold text-action-text">
                  {selected.multiYearsMicrocopy} ({selected.fundingSource})
                </p>
              )}

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="flex items-start gap-1.5 font-semibold">
                  <MapPinned className="mt-0.5 size-4 shrink-0 text-brand" />
                  {selected.locationDesc} ({selected.precisionBadge})
                </p>
                {selected.precisionMicrocopy && (
                  <p className="mt-1 text-xs text-slate-600">{selected.precisionMicrocopy}</p>
                )}
                {selected.precisionResolutionNote && (
                  <p className="mt-2 rounded-lg bg-action-bg p-2 text-xs text-action-text">
                    {selected.precisionResolutionNote}
                  </p>
                )}
                {selected.canonicalMicrocopy && (
                  <p className="mt-2 rounded-lg bg-ok-bg p-2 text-xs font-semibold text-ok-text">
                    {selected.canonicalMicrocopy}
                  </p>
                )}
              </div>

              {selected.subLocations && (
                <SubLocationTabs locations={selected.subLocations} microcopy={selected.subLocationsMicrocopy} />
              )}

              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Indikator Risiko Kontrak
                </p>
                <ContractRiskBadges flags={selected.riskFlags} />
              </div>

              {selected.isRetender && selected.retenderMicrocopy && (
                <TenderHistoryAccordion
                  title={selected.retenderMicrocopy}
                  tenders={selected.failedTenders}
                  currentCode={selected.spseCode}
                />
              )}

              <p className="flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <Database className="size-3.5" /> {selected.sourceNote}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
