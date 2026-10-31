import { useState } from 'react';
import { AlertTriangle, ImageOff, MapPin, ThumbsDown, ThumbsUp, Users } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import ExifCheckBadge from '../common/ExifCheckBadge';
import StatusBadge from '../common/StatusBadge';

export default function VerificationQueueView() {
  const { queue, vote, canVote, compactRupiah } = useWarta();
  const [activeId, setActiveId] = useState<string | null>(queue[0]?.id ?? null);
  const item = queue.find((q) => q.id === activeId) ?? queue[0];
  void compactRupiah;

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-4 p-4">
      <h1 className="text-2xl font-extrabold text-slate-900">Antrean Verifikasi Warga</h1>
      <p className="flex items-start gap-2 rounded-xl border border-action-border bg-action-bg p-3 text-sm text-action-text">
        <Users className="mt-0.5 size-4 shrink-0" />
        Status berubah otomatis setelah cukup verifikasi warga (3 suara). Tidak ada admin.
      </p>

      {queue.length === 0 ? (
        <p className="text-sm text-slate-500">Antrean kosong.</p>
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row">
          <ul className="space-y-2 lg:w-[40%]">
            {queue.map((q) => (
              <li key={q.id}>
                <button
                  id={`queue-${q.id}`}
                  onClick={() => setActiveId(q.id)}
                  className={`w-full rounded-2xl border bg-white p-3 text-left transition hover:shadow ${
                    q.id === item?.id ? 'border-action-border ring-2 ring-action-border/40' : 'border-slate-200'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500">
                      {q.itemType === 'klaim_lokasi' ? 'Klaim Lokasi' : 'Laporan Kondisi'}
                    </span>
                    <StatusBadge status={q.status} />
                  </div>
                  <p className="font-bold">{q.projectTitle}</p>
                  <p className="text-xs text-slate-500">#{q.spseCode} • Pagu {q.paguCompact}</p>
                  <Progress agree={q.votesAgree} target={q.targetVotes} />
                </button>
              </li>
            ))}
          </ul>

          {item && (
            <article className="flex-1 space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">{item.categoryLabel}</p>
                  <h2 className="text-xl font-extrabold">{item.projectTitle}</h2>
                  <p className="text-sm text-slate-500">#{item.spseCode} • {item.satker}</p>
                  <p className="text-sm font-bold text-brand">Pagu {item.paguCompact}</p>
                </div>
                <StatusBadge status={item.status} size="md" />
              </div>

              <Photo src={item.photoUrl} alt={`Foto bukti ${item.projectTitle}`} />

              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <p><span className="text-slate-500">Pelapor:</span> <b>{item.authorDisplayName}</b></p>
                <p><span className="text-slate-500">Dikirim:</span> {item.createdAt}</p>
                <p className="flex items-center gap-1 sm:col-span-2"><MapPin className="size-4 text-brand" />{item.distanceFromProject}</p>
                {item.itemType === 'klaim_lokasi' && (
                  <p className="sm:col-span-2"><span className="text-slate-500">Usulan lokasi:</span> {item.proposedAddress}</p>
                )}
              </div>
              <ExifCheckBadge valid={item.exifValid} />
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{item.narrative}</p>

              <div>
                <Progress agree={item.votesAgree} target={item.targetVotes} />
                <p className="mt-1 text-xs text-slate-500">Tidak setuju: {item.votesDisagree}</p>
              </div>

              <VoteButtons
                id={item.id}
                check={canVote(item)}
                onVote={(c) => vote(item.id, c)}
              />
            </article>
          )}
        </div>
      )}
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
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-wait-border bg-wait-bg p-3 text-sm text-wait-text">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />{check.reason}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button id={`agree-${id}`} disabled={!check.allowed} onClick={() => onVote('setuju')} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-ok-border bg-ok-bg py-3 font-semibold text-ok-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
          <ThumbsUp className="size-4" /> Setuju (Sesuai Lapangan)
        </button>
        <button id={`disagree-${id}`} disabled={!check.allowed} onClick={() => onVote('tidak_setuju')} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-bad-border bg-bad-bg py-3 font-semibold text-bad-text transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50">
          <ThumbsDown className="size-4" /> Tidak Setuju (Tidak Akurat)
        </button>
      </div>
    </div>
  );
}

function Progress({ agree, target }: { agree: number; target: number }) {
  const pct = Math.min(100, (agree / target) * 100);
  return (
    <div className="mt-2">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-ok-border transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs font-semibold text-slate-600">{Math.min(agree, target)}/{target} suara setuju</p>
    </div>
  );
}

function Photo({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (err)
    return (
      <div className="flex h-56 items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm text-slate-500">
        <ImageOff className="size-5" /> Foto tidak dapat dimuat
      </div>
    );
  return <img src={src} alt={alt} onError={() => setErr(true)} className="h-56 w-full rounded-xl object-cover" />;
}
