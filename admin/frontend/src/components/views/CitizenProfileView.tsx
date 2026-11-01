import { useState } from 'react';
import { EyeOff, LogIn, LogOut, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { REPORT_CATEGORY_LABELS } from '../../data/wartaData';
import StatusBadge from '../common/StatusBadge';

type Tab = 'laporan' | 'klaim' | 'verifikasi';
const TABS: { id: Tab; l: string }[] = [
  { id: 'laporan', l: 'Laporan Saya' },
  { id: 'klaim', l: 'Klaim Lokasi Saya' },
  { id: 'verifikasi', l: 'Riwayat Verifikasi Saya' },
];
const CANONICAL = 'Klaim lokasi ini sudah terverifikasi dan menjadi lokasi kanonik paket.';

export default function CitizenProfileView() {
  const { currentUser, myReports, myClaims, voteHistory, logout, setLoginOpen } = useWarta();
  const [tab, setTab] = useState<Tab>('laporan');

  if (!currentUser)
    return (
      <div className="mx-auto w-full max-w-lg flex-1 p-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <UserRound className="mx-auto mb-3 size-12 text-slate-400" />
          <h1 className="mb-1 text-xl font-bold">Anda belum masuk</h1>
          <p className="mb-5 text-sm text-slate-500">Masuk dengan Nama Tampilan Publik untuk melihat aktivitas.</p>
          <button id="profile-login" onClick={() => setLoginOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white">
            <LogIn className="size-4" /> Masuk
          </button>
        </div>
      </div>
    );

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-brand-dark bg-brand p-5 text-white">
        <span className="grid size-14 place-items-center rounded-full bg-white/15 text-xl font-black">{currentUser.replace('Warga_', '')[0]}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold">{currentUser}</h1>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-sky-100">
            <EyeOff className="mt-0.5 size-3.5 shrink-0" />
            Nama tampilan bersifat publik. Alamat email Anda disembunyikan dan tidak pernah ditampilkan ke publik.
          </p>
        </div>
        <button id="profile-logout" onClick={logout} className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
          <LogOut className="size-4" /> Keluar
        </button>
      </div>

      <div role="tablist" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1">
        {TABS.map((t) => (
          <button key={t.id} id={`profile-tab-${t.id}`} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-white text-brand shadow' : 'text-slate-600 hover:text-slate-900'}`}>
            {t.l}
          </button>
        ))}
      </div>

      <ul className="space-y-2" role="tabpanel">
        {tab === 'laporan' && (myReports.length === 0 ? <Empty /> : myReports.map((r) => (
          <li key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="font-bold">{r.projectTitle}</p>
              <StatusBadge status={r.status} />
            </div>
            <p className="text-xs text-slate-500">#{r.spseCode} • {REPORT_CATEGORY_LABELS[r.category]} • {r.createdAt}</p>
            <p className="mt-2 text-sm text-slate-700">{r.narrative}</p>
          </li>
        )))}

        {tab === 'klaim' && (myClaims.length === 0 ? <Empty /> : myClaims.map((c) => (
          <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="font-bold">{c.projectTitle}</p>
              <StatusBadge status={c.status} />
            </div>
            <p className="text-xs text-slate-500">#{c.spseCode} • Presisi {c.proposedPrecision} • {c.createdAt}</p>
            <p className="mt-2 text-sm text-slate-700">{c.proposedAddress}</p>
            {c.status === 'diterima' && <p className="mt-2 rounded-lg bg-ok-bg p-2 text-sm font-medium text-ok-text">{CANONICAL}</p>}
          </li>
        )))}

        {tab === 'verifikasi' && (voteHistory.length === 0 ? <Empty /> : voteHistory.map((v) => (
          <li key={v.itemId + v.votedAt} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <span className={`grid size-9 shrink-0 place-items-center rounded-full ${v.choice === 'setuju' ? 'bg-ok-bg text-ok-text' : 'bg-bad-bg text-bad-text'}`}>
              {v.choice === 'setuju' ? <ThumbsUp className="size-4" /> : <ThumbsDown className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{v.projectTitle}</p>
              <p className="text-xs text-slate-500">
                {v.itemType === 'klaim_lokasi' ? 'Klaim lokasi' : 'Laporan kondisi'} oleh {v.authorDisplayName} • {v.votedAt}
              </p>
            </div>
            <span className={`text-xs font-bold ${v.choice === 'setuju' ? 'text-ok-text' : 'text-bad-text'}`}>
              {v.choice === 'setuju' ? 'SETUJU' : 'TIDAK SETUJU'}
            </span>
          </li>
        )))}
      </ul>
    </div>
  );
}

function Empty() {
  return <li className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Belum ada aktivitas.</li>;
}
