import { useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  EyeOff,
  FileText,
  LogIn,
  LogOut,
  MailWarning,
  MapPin,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { REPORT_CATEGORY_LABELS } from '../../data/wartaData';
import type { ClaimStatus, ReportStatus } from '../../types/warta';
import StatusBadge from '../common/StatusBadge';

type Tab = 'laporan' | 'klaim' | 'suara';

const DISPLAY_NAME_REGEX = /^[A-Za-z0-9_]{3,24}$/;

export default function CitizenAccountView() {
  const {
    currentUser,
    userProfile,
    myReports,
    myClaims,
    voteHistory,
    logout,
    setLoginOpen,
    navigate,
    startEditDraft,
    deleteReport,
    updateDisplayName,
    verifyCurrentEmail,
  } = useWarta();

  const [tab, setTab] = useState<Tab>('laporan');
  const [reportFilter, setReportFilter] = useState<'semua' | ReportStatus>('semua');
  const [claimFilter, setClaimFilter] = useState<'semua' | ClaimStatus>('semua');

  // Edit display_name (PATCH /users/me)
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(currentUser ?? '');
  const [nameError, setNameError] = useState('');
  const [resendNotice, setResendNotice] = useState('');

  if (!currentUser || !userProfile) {
    return (
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-slate-100">
            <UserRound className="size-7 text-slate-400" />
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">Belum masuk ke akun warga</h1>
          <p className="mt-1.5 mb-6 text-sm leading-relaxed text-slate-600">
            Masuk atau daftar akun terlebih dahulu untuk melihat daftar aduan Anda, melanjutkan draf yang tersimpan, serta memantau status verifikasi.
          </p>
          <button
            type="button"
            id="profile-login"
            onClick={() => setLoginOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
          >
            <LogIn className="size-4" /> Masuk / Daftar Akun Warga
          </button>
        </div>
      </div>
    );
  }

  const filteredReports = myReports.filter(
    (r) => reportFilter === 'semua' || r.status === reportFilter,
  );
  const filteredClaims = myClaims.filter(
    (c) => claimFilter === 'semua' || c.status === claimFilter,
  );

  const saveDisplayName = (e: FormEvent) => {
    e.preventDefault();
    setNameError('');
    const trimmed = newName.trim();
    if (!DISPLAY_NAME_REGEX.test(trimmed)) {
      setNameError('Nama tampilan harus 3–24 karakter (huruf, angka, atau garis bawah).');
      return;
    }
    updateDisplayName(trimmed);
    setEditingName(false);
  };

  const initials = currentUser
    .replace('Warga_', '')
    .split('_')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-6 sm:px-6">
      {/* Banner Verifikasi Email jika belum terverifikasi (POST /auth/resend-verification & /auth/verify-email) */}
      {!userProfile.emailVerified && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex items-start gap-2.5">
            <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold">Email akun Anda ({userProfile.email}) belum diverifikasi</p>
              <p className="text-xs text-amber-800">
                Verifikasi email diperlukan sebelum mengirim pengaduan atau klaim lokasi ke publik.
              </p>
              {resendNotice && (
                <p className="mt-1 text-xs font-semibold text-ok-text">{resendNotice}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setResendNotice('Tautan verifikasi baru telah dikirim ke email Anda (batas 3x/jam).')
              }
              className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              Kirim Ulang Email
            </button>
            <button
              type="button"
              onClick={verifyCurrentEmail}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              Verifikasi Sekarang
            </button>
          </div>
        </div>
      )}

      {/* Header Profil Privat (GET /auth/me) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span className="grid size-13 shrink-0 place-items-center rounded-2xl bg-brand text-lg font-extrabold text-white">
              {initials}
            </span>
            <div className="min-w-0 space-y-1">
              {editingName ? (
                <form onSubmit={saveDisplayName} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingName(false);
                        setNameError('');
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
                    >
                      Batal
                    </button>
                  </div>
                  {nameError && <p className="text-xs text-bad-text">{nameError}</p>}
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-extrabold text-slate-900">{currentUser}</h1>
                  <button
                    type="button"
                    onClick={() => {
                      setNewName(currentUser);
                      setEditingName(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Edit3 className="size-3" /> Ubah nama
                  </button>
                </div>
              )}

              <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <EyeOff className="size-3.5 text-slate-400" />
                  Email privat: <b className="text-slate-700">{userProfile.email}</b> (hanya terlihat oleh Anda)
                </span>
                {userProfile.emailVerified && (
                  <span className="inline-flex items-center gap-1 font-semibold text-ok-text">
                    <CheckCircle2 className="size-3.5" /> Email terverifikasi
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('lapor')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
            >
              <Plus className="size-4" /> Buat Pengaduan
            </button>
            <button
              type="button"
              id="profile-logout"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <LogOut className="size-4" /> Keluar
            </button>
          </div>
        </div>

        {/* Statistik Ringkas */}
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4 text-center sm:text-left">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-lg font-extrabold tabular-nums text-slate-900">{myReports.length}</p>
            <p className="text-xs text-slate-500">
              Laporan kondisi ({myReports.filter((r) => r.status === 'draft').length} draf)
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-lg font-extrabold tabular-nums text-slate-900">{myClaims.length}</p>
            <p className="text-xs text-slate-500">Usulan klaim lokasi</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-lg font-extrabold tabular-nums text-slate-900">{voteHistory.length}</p>
            <p className="text-xs text-slate-500">Suara verifikasi diberikan</p>
          </div>
        </div>
      </section>

      {/* Navigasi Tab */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Riwayat kiriman warga"
          className="inline-flex rounded-xl border border-slate-200 bg-white p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'laporan'}
            onClick={() => setTab('laporan')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
              tab === 'laporan' ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="size-4" /> Laporan Saya ({myReports.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'klaim'}
            onClick={() => setTab('klaim')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
              tab === 'klaim' ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="size-4" /> Klaim Lokasi ({myClaims.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'suara'}
            onClick={() => setTab('suara')}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition sm:text-sm ${
              tab === 'suara' ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BadgeCheck className="size-4" /> Riwayat Suara ({voteHistory.length})
          </button>
        </div>

        {/* Filter Status per Tab (GET /users/me/reports?status=... & /users/me/claims?status=...) */}
        {tab === 'laporan' && (
          <select
            aria-label="Filter status laporan saya"
            value={reportFilter}
            onChange={(e) => setReportFilter(e.target.value as 'semua' | ReportStatus)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-brand"
          >
            <option value="semua">Semua status laporan</option>
            <option value="draft">Draf (belum dikirim)</option>
            <option value="menunggu">Menunggu verifikasi</option>
            <option value="terverifikasi">Terverifikasi</option>
            <option value="ditolak">Ditolak</option>
            <option value="selesai">Selesai</option>
          </select>
        )}

        {tab === 'klaim' && (
          <select
            aria-label="Filter status klaim saya"
            value={claimFilter}
            onChange={(e) => setClaimFilter(e.target.value as 'semua' | ClaimStatus)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-brand"
          >
            <option value="semua">Semua status klaim</option>
            <option value="menunggu">Menunggu verifikasi</option>
            <option value="diterima">Diterima (lokasi kanonik)</option>
            <option value="ditolak">Ditolak</option>
          </select>
        )}
      </div>

      {/* Isi Tab 1: Laporan Saya */}
      {tab === 'laporan' && (
        <ul className="space-y-3">
          {filteredReports.length === 0 ? (
            <EmptyBox text="Belum ada laporan kondisi pada filter ini." />
          ) : (
            filteredReports.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
                        {REPORT_CATEGORY_LABELS[r.category]}
                      </span>
                      <span className="font-mono text-xs text-slate-500">#{r.spseCode}</span>
                      <span className="text-xs text-slate-400">· {r.createdAt}</span>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-slate-900">{r.projectTitle}</h2>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <p className="mt-2 text-sm leading-relaxed text-slate-700">{r.narrative}</p>
                {r.proposedAddress && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Lokasi pengamatan: {r.proposedAddress}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => navigate('detail', r.projectId)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    <ExternalLink className="size-3.5" /> Buka Detail Proyek SPSE
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {r.status === 'draft' && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditDraft(r.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-dark"
                        >
                          <Edit3 className="size-3.5" /> Edit & Kirim Draf
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteReport(r.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-bad-border/40 bg-bad-bg px-3 py-1.5 text-xs font-semibold text-bad-text hover:brightness-95"
                        >
                          <Trash2 className="size-3.5" /> Hapus Draf
                        </button>
                      </>
                    )}

                    {r.status === 'menunggu' && (
                      <button
                        type="button"
                        onClick={() => deleteReport(r.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Trash2 className="size-3.5 text-bad-text" /> Tarik Kembali Laporan
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Isi Tab 2: Klaim Lokasi Saya */}
      {tab === 'klaim' && (
        <ul className="space-y-3">
          {filteredClaims.length === 0 ? (
            <EmptyBox text="Belum ada klaim lokasi pada filter ini." />
          ) : (
            filteredClaims.map((c) => (
              <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">
                        Presisi: {c.proposedPrecision}
                      </span>
                      <span className="font-mono text-xs text-slate-500">#{c.spseCode}</span>
                      <span className="text-xs text-slate-400">· {c.createdAt}</span>
                    </div>
                    <h2 className="mt-1 text-base font-bold text-slate-900">{c.projectTitle}</h2>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <p className="mt-2 text-sm text-slate-700">{c.proposedAddress}</p>

                {c.status === 'diterima' && (
                  <p className="mt-2.5 rounded-xl border border-ok-border/40 bg-ok-bg px-3 py-2 text-xs font-medium text-ok-text">
                    Klaim lokasi ini sudah terverifikasi dan menjadi lokasi kanonik paket.
                  </p>
                )}

                <div className="mt-3 border-t border-slate-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => navigate('detail', c.projectId)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                  >
                    <ExternalLink className="size-3.5" /> Buka Detail Proyek SPSE
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Isi Tab 3: Riwayat Suara Saya (GET /users/me/votes + resolution) */}
      {tab === 'suara' && (
        <ul className="space-y-3">
          {voteHistory.length === 0 ? (
            <EmptyBox text="Anda belum memberikan suara verifikasi pada kiriman warga lain." />
          ) : (
            voteHistory.map((v, idx) => (
              <li
                key={`${v.itemId}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                      v.choice === 'setuju' ? 'bg-ok-bg text-ok-text' : 'bg-bad-bg text-bad-text'
                    }`}
                  >
                    {v.choice === 'setuju' ? (
                      <ThumbsUp className="size-4" />
                    ) : (
                      <ThumbsDown className="size-4" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{v.projectTitle}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {v.itemType === 'klaim_lokasi' ? 'Klaim Lokasi' : 'Laporan Kondisi'} oleh{' '}
                      <b className="text-slate-700">{v.authorDisplayName}</b> · {v.votedAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      v.choice === 'setuju' ? 'bg-ok-bg text-ok-text' : 'bg-bad-bg text-bad-text'
                    }`}
                  >
                    Suara Anda: {v.choice === 'setuju' ? 'Setuju' : 'Tidak Setuju'}
                  </span>
                  {v.resolution && <StatusBadge status={v.resolution} size="sm" />}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <li className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-slate-100">
        <ClipboardList className="size-6 text-slate-400" />
      </span>
      <p className="text-sm font-bold text-slate-900">Belum ada data</p>
      <p className="mt-1 text-xs text-slate-500">{text}</p>
    </li>
  );
}
