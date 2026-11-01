import { useState } from 'react';
import { AlertTriangle, RotateCcw, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { OWNER_WARNING } from '../../context/WartaContext';
import { INITIAL_VERIFICATION_QUEUE } from '../../data/wartaData';
import type { UserRole } from '../../types/warta';
import ExifCheckBadge from '../common/ExifCheckBadge';
import StatusBadge from '../common/StatusBadge';

export default function InteractiveConsensusDemo() {
  const baseItem = INITIAL_VERIFICATION_QUEUE[2]; // Klaim Lokasi TPST Bantargebang (2/3 suara)
  const [role, setRole] = useState<UserRole>('other');
  const [agree, setAgree] = useState(2);
  const [disagree, setDisagree] = useState(0);
  const [voted, setVoted] = useState(false);

  const status = agree >= 3 ? 'diterima' : disagree >= 3 ? 'ditolak' : 'menunggu';
  const canVote = role === 'other' && !voted && status === 'menunggu';

  const resetDemo = () => {
    setAgree(2);
    setDisagree(0);
    setVoted(false);
    setRole('other');
  };

  return (
    <section id="simulasi-konsensus" className="border-y border-slate-200 bg-slate-100/80 py-14">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="inline-block rounded-full bg-ok-bg px-3 py-1 text-xs font-bold uppercase tracking-wider text-ok-text">
              Uji Coba Interaktif
            </span>
            <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
              Simulasikan Mekanisme Verifikasi 3 Suara & Anti-Self-Vote
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Coba ganti peran di bawah ini antara <b>Warga Lain</b> dan <b>Pemilik Laporan</b> untuk melihat bagaimana
              sistem mencegah verifikasi mandiri dan mengubah status secara otomatis tanpa admin.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
            <span className="px-2 font-bold">Peran Simulasi:</span>
            <button
              type="button"
              onClick={() => setRole('other')}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                role === 'other' ? 'bg-brand text-white' : 'bg-white text-slate-700'
              }`}
            >
              Warga Lain (Bisa Vote)
            </button>
            <button
              type="button"
              onClick={() => setRole('owner')}
              className={`rounded-lg px-3 py-1.5 font-bold transition ${
                role === 'owner' ? 'bg-brand text-white' : 'bg-white text-slate-700'
              }`}
            >
              Pemilik Laporan (Diblokir)
            </button>
            <button
              type="button"
              onClick={resetDemo}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-semibold hover:bg-amber-100"
            >
              <RotateCcw className="size-3.5" /> Reset
            </button>
          </div>
        </div>

        <div className="grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-5">
            <img
              src={baseItem.photoUrl}
              alt={baseItem.projectTitle}
              className="h-56 w-full rounded-2xl border border-slate-200 object-cover"
            />
            <ExifCheckBadge valid={baseItem.exifValid} />
            <div className="rounded-xl bg-ok-bg p-3 text-xs text-ok-text">
              <p className="font-bold">Dampak Konsensus Warga:</p>
              <p className="mt-0.5">
                Jika 3 warga di sekitar lokasi menyetujui klaim ini, sistem otomatis memperbarui lokasi utama proyek
                menjadi titik pilihan warga dengan penanda <b>Sumber: Warga</b>.
              </p>
            </div>
          </div>

          <div className="flex flex-col justify-between space-y-4 lg:col-span-7">
            <div className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase text-action-border">{baseItem.categoryLabel}</span>
                  <h3 className="text-xl font-extrabold text-slate-900">{baseItem.projectTitle}</h3>
                  <p className="text-xs text-slate-500">
                    #{baseItem.spseCode} • Pagu <b>{baseItem.paguCompact}</b> • Pengusul: <b>{baseItem.authorDisplayName}</b>
                  </p>
                </div>
                <StatusBadge status={status} size="md" />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs font-semibold text-slate-500">Usulan Titik Lokasi Kanonik:</p>
                <p className="font-bold text-slate-900">{baseItem.proposedAddress}</p>
                <p className="mt-1 text-slate-600">{baseItem.narrative}</p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1 text-slate-700">
                    <Users className="size-4 text-brand" /> Progres Verifikasi Warga: {agree}/3 Suara Setuju
                  </span>
                  <span className="text-slate-500">Tidak setuju: {disagree}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-ok-border transition-all duration-500"
                    style={{ width: `${Math.min(100, (agree / 3) * 100)}%` }}
                  />
                </div>
              </div>

              {status === 'diterima' && (
                <div className="animate-pop rounded-xl border border-ok-border bg-ok-bg p-3 text-sm font-bold text-ok-text">
                  ✓ "Klaim lokasi ini sudah terverifikasi dan menjadi lokasi kanonik paket."
                </div>
              )}

              {role === 'owner' && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-wait-border bg-wait-bg p-3 text-sm text-wait-text"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>{OWNER_WARNING}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                disabled={!canVote}
                onClick={() => {
                  setAgree((v) => v + 1);
                  setVoted(true);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ok-border bg-ok-bg py-3 text-sm font-bold text-ok-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ThumbsUp className="size-4" /> Setuju (Sesuai Lapangan)
              </button>
              <button
                type="button"
                disabled={!canVote}
                onClick={() => {
                  setDisagree((v) => v + 1);
                  setVoted(true);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-bad-border bg-bad-bg py-3 text-sm font-bold text-bad-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ThumbsDown className="size-4" /> Tidak Setuju (Tidak Akurat)
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
