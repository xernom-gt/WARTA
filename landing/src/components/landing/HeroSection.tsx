import { useState } from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Database,
  MapPin,
  ShieldCheck,
  ThumbsUp,
  Users,
} from 'lucide-react';
import { DATASET_SUMMARY, WARTA_PROJECTS } from '../../data/wartaData';
import ExifCheckBadge from '../common/ExifCheckBadge';
import StatusBadge from '../common/StatusBadge';

interface Props {
  appUrl?: string;
}

export default function HeroSection({ appUrl = 'http://localhost:5173' }: Props) {
  const sample = WARTA_PROJECTS[0]; // Rusun Rorotan IX Tahap I
  const [heroVotes, setHeroVotes] = useState(2);
  const [hasVoted, setHasVoted] = useState(false);

  const handleQuickVote = () => {
    if (!hasVoted) {
      setHeroVotes(3);
      setHasVoted(true);
    } else {
      setHeroVotes(2);
      setHasVoted(false);
    }
  };

  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-brand via-brand to-brand-dark text-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 lg:grid-cols-12 lg:py-16">
        {/* Kolom Kiri: Copywriting Utama */}
        <div className="space-y-6 lg:col-span-7">
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-sky-100">
            <ShieldCheck className="size-4 text-sky-300" />
            <span>Platform Crowdsourcing Warga • Tanpa Admin • Ambang Konsensus 3 Suara</span>
          </div>

          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Pantau Proyek Pemerintah di Depan Rumahmu,{' '}
            <span className="text-sky-300">Langsung dari Data SPSE.</span>
          </h1>

          <p className="max-w-2xl text-base leading-relaxed text-sky-100 sm:text-lg">
            Dari <b>{DATASET_SUMMARY.uniqueProjects} proyek konstruksi</b> di DKI Jakarta,{' '}
            <b>{DATASET_SUMMARY.precisionBreakdown.kabupatenKota} paket</b> masih tercatat sebatas nama kota tanpa titik pasti.
            Bersama warga sekitar, klaim lokasi kanonik, laporkan progres fisik dengan foto ber-geotag, dan verifikasi
            secara gotong royong <b>tanpa menunggu admin</b>.
          </p>

          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={appUrl}
              className="inline-flex items-center gap-2 rounded-xl border border-action-border bg-action-bg px-6 py-3.5 text-sm font-extrabold text-action-text shadow-lg transition hover:-translate-y-0.5 hover:bg-white"
            >
              Jelajahi Peta Proyek <ArrowRight className="size-4" />
            </a>
            <a
              href="#alur-kerja"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/20"
            >
              Pelajari Cara Kerja
            </a>
          </div>

          {/* 4 Metrik Kunci */}
          <dl className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3.5">
              <dt className="text-xs text-sky-200">Proyek Unik SPSE</dt>
              <dd className="mt-0.5 text-2xl font-black text-white">{DATASET_SUMMARY.uniqueProjects}</dd>
              <p className="text-[11px] text-sky-200/80">dari {DATASET_SUMMARY.totalRawPackages} baris tender</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3.5">
              <dt className="text-xs text-sky-200">Lokasi Tingkat Kota</dt>
              <dd className="mt-0.5 text-2xl font-black text-amber-300">
                {DATASET_SUMMARY.precisionBreakdown.kabupatenKota}
              </dd>
              <p className="text-[11px] text-sky-200/80">butuh klaim titik warga</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3.5">
              <dt className="text-xs text-sky-200">Ambang Verifikasi</dt>
              <dd className="mt-0.5 text-2xl font-black text-emerald-300">3 Suara</dd>
              <p className="text-[11px] text-sky-200/80">otomatis tanpa admin</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-3.5">
              <dt className="text-xs text-sky-200">Privasi Warga</dt>
              <dd className="mt-0.5 text-2xl font-black text-sky-200">Nama Publik</dd>
              <p className="text-[11px] text-sky-200/80">email disembunyikan</p>
            </div>
          </dl>
        </div>

        {/* Kolom Kanan: Kartu Mockup Interaktif */}
        <div className="lg:col-span-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand">
                <Camera className="size-3.5" /> Cuplikan Laporan Warga
              </span>
              <StatusBadge status={heroVotes >= 3 ? 'terverifikasi' : 'menunggu'} size="md" />
            </div>

            <div className="space-y-3">
              <div>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                  {sample.category} • #{sample.spseCode}
                </span>
                <h2 className="mt-1 text-lg font-extrabold text-slate-900">{sample.title}</h2>
                <p className="text-xs text-slate-500">{sample.satker}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-xs">
                <div>
                  <p className="text-slate-500">Pagu</p>
                  <p className="font-extrabold text-brand">{sample.paguCompact}</p>
                </div>
                <div>
                  <p className="text-slate-500">HPS</p>
                  <p className="font-bold text-slate-800">{sample.hpsCompact}</p>
                </div>
                <div>
                  <p className="text-slate-500">Kontrak</p>
                  <p className="font-bold text-slate-800">{sample.kontrakCompact}</p>
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-wait-border/50 bg-wait-bg/60 p-2.5 text-xs text-wait-text">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">{sample.precisionBadge} — {sample.locationDesc}</p>
                  <p>{sample.precisionMicrocopy}</p>
                </div>
              </div>

              <ExifCheckBadge valid={true} />

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1 font-semibold text-slate-700">
                    <Users className="size-3.5 text-brand" /> Konsensus Warga ({heroVotes}/3 suara setuju)
                  </span>
                  <span className="font-semibold text-ok-text">
                    {heroVotes >= 3 ? 'Ambang tercapai!' : 'Butuh 1 suara lagi'}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-ok-border transition-all duration-500"
                    style={{ width: `${(heroVotes / 3) * 100}%` }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleQuickVote}
                  className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${
                    hasVoted
                      ? 'border-ok-border bg-ok-bg text-ok-text'
                      : 'border-action-border bg-action-bg text-action-text hover:brightness-95'
                  }`}
                >
                  {hasVoted ? (
                    <>
                      <CheckCircle2 className="size-4" /> Status Otomatis Berubah: Terverifikasi (Klik untuk Reset)
                    </>
                  ) : (
                    <>
                      <ThumbsUp className="size-4" /> Coba Beri Suara ke-3 (Simulasi Langsung)
                    </>
                  )}
                </button>
              </div>

              <p className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Database className="size-3" /> {sample.sourceNote}
                </span>
                <span>{sample.multiYearsMicrocopy}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
