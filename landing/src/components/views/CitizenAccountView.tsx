import { useState, useEffect, useMemo, type FormEvent } from 'react';
import axios from 'axios';
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardList,
  Edit3,
  ExternalLink,
  EyeOff,
  FileText,
  Loader2,
  LogIn,
  LogOut,
  MailWarning,
  MapPin,
  MapPinCheck,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { REPORT_CATEGORY_LABELS, WARTA_PROJECTS } from '../../data/wartaData';
import type { CitizenReport, ClaimStatus, ReportStatus } from '../../types/warta';
import { authService } from '../../services/auth';
import { userService, reportToCitizenReport } from '../../services/users';
import { reportsService } from '../../services/reports';
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

  // Laporan dari API
  const [apiReports, setApiReports] = useState<CitizenReport[] | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  // Edit display_name (PATCH /users/me)
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(currentUser ?? '');
  const [nameError, setNameError] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Kirim ulang verifikasi email (POST /auth/resend-verification)
  const [isResending, setIsResending] = useState(false);
  const [resendNotice, setResendNotice] = useState('');
  const [resendError, setResendError] = useState('');

  // Fetch riwayat laporan dari API (GET /users/me/reports)
  useEffect(() => {
    if (!currentUser) return;
    const controller = new AbortController();

    const fetchReports = async () => {
      await Promise.resolve();
      setLoadingReports(true);
      try {
        const res = await userService.getMyReports(
          {
            status: reportFilter !== 'semua' ? reportFilter : undefined,
          },
          controller.signal,
        );
        const projectMap = new Map(WARTA_PROJECTS.map((p) => [p.id, p]));
        const mapped = res.data.map((r) =>
          reportToCitizenReport(r, projectMap.get(r.project_id)),
        );
        setApiReports(mapped);
      } catch {
        if (!controller.signal.aborted) {
          // Fallback graceful ke context
          setApiReports(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingReports(false);
        }
      }
    };

    fetchReports();

    return () => controller.abort();
  }, [currentUser, reportFilter]);

  const activeReports = useMemo(() => {
    return apiReports !== null ? apiReports : myReports;
  }, [apiReports, myReports]);

  const filteredReports = useMemo(() => {
    return activeReports.filter(
      (r) => reportFilter === 'semua' || r.status === reportFilter,
    );
  }, [activeReports, reportFilter]);

  const filteredClaims = useMemo(() => {
    return myClaims.filter(
      (c) => claimFilter === 'semua' || c.status === claimFilter,
    );
  }, [myClaims, claimFilter]);

  if (!currentUser || !userProfile) {
    return (
      <div className="mx-auto w-full max-w-md flex-1 px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-slate-100">
            <UserRound className="size-7 text-slate-500" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">Belum masuk ke akun warga</h1>
          <p className="mt-2 mb-6 text-base leading-relaxed text-slate-600">
            Masuk atau daftar akun terlebih dahulu untuk melihat daftar aduan Anda, melanjutkan draf yang tersimpan, serta memantau status verifikasi.
          </p>
          <button
            type="button"
            id="profile-login"
            onClick={() => setLoginOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white transition hover:bg-brand-dark"
          >
            <LogIn className="size-4" aria-hidden="true" /> Masuk / Daftar Akun Warga
          </button>
        </div>
      </div>
    );
  }

  const saveDisplayName = async (e: FormEvent) => {
    e.preventDefault();
    setNameError('');
    const trimmed = newName.trim();
    if (!DISPLAY_NAME_REGEX.test(trimmed)) {
      setNameError('Nama tampilan harus 3 sampai 24 karakter (huruf, angka, atau garis bawah).');
      return;
    }
    setIsSavingName(true);
    try {
      const updatedUser = await userService.updateMe({ display_name: trimmed });
      updateDisplayName(updatedUser.display_name);
      setEditingName(false);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          setNameError('Nama tampilan sudah digunakan oleh warga lain.');
          return;
        }
        const msg = err.response?.data?.error?.message;
        if (msg) {
          setNameError(msg);
          return;
        }
      }
      // Fallback lokal jika ada gangguan jaringan
      updateDisplayName(trimmed);
      setEditingName(false);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleResendVerification = async () => {
    setIsResending(true);
    setResendNotice('');
    setResendError('');
    try {
      await authService.resendVerification();
      setResendNotice(
        'Tautan verifikasi baru telah dikirim ke email Anda (batas 3x/jam). Cek log server/inbox email.',
      );
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 429) {
          setResendError(
            'Batas pengiriman tercapai: maksimal 3 kali per jam per akun. Silakan coba lagi nanti.',
          );
          return;
        }
        const msg = err.response?.data?.error?.message;
        if (msg) {
          setResendError(msg);
          return;
        }
      }
      setResendError('Gagal mengirim ulang email verifikasi. Periksa koneksi internet Anda.');
    } finally {
      setIsResending(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    setDeletingReportId(reportId);
    try {
      await reportsService.deleteReport(reportId);
    } catch {
      // Abaikan gangguan koneksi dan lanjutkan pembersihan state lokal
    } finally {
      if (apiReports) {
        setApiReports((prev) => (prev ? prev.filter((r) => r.id !== reportId) : null));
      }
      deleteReport(reportId);
      setDeletingReportId(null);
    }
  };

  const initials = currentUser
    .replace('Warga_', '')
    .split('_')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 space-y-8 px-4 py-10 sm:px-6 sm:py-12">
      {/* Banner Verifikasi Email jika belum terverifikasi */}
      {!userProfile.emailVerified && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
          <div className="flex items-start gap-3">
            <MailWarning className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="font-bold">Email akun Anda ({userProfile.email}) belum diverifikasi</p>
              <p className="mt-0.5 text-sm text-amber-900">
                Verifikasi email diperlukan sebelum mengirim pengaduan atau klaim lokasi ke publik.
              </p>
              {resendNotice && (
                <p className="mt-1.5 text-sm font-semibold text-ok-text">{resendNotice}</p>
              )}
              {resendError && (
                <p className="mt-1.5 text-sm font-semibold text-bad-text">{resendError}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isResending}
              onClick={handleResendVerification}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 bg-white px-3.5 py-2 text-xs font-semibold text-amber-950 transition hover:bg-amber-100 disabled:opacity-60"
            >
              {isResending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  Mengirim...
                </>
              ) : (
                'Kirim Ulang Email'
              )}
            </button>
            <button
              type="button"
              onClick={verifyCurrentEmail}
              className="rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-dark"
            >
              Tandai Terverifikasi
            </button>
          </div>
        </div>
      )}

      {/* Header Profil Privat */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-brand text-lg font-extrabold text-white">
              {initials}
            </span>
            <div className="min-w-0 space-y-1.5">
              {editingName ? (
                <form onSubmit={saveDisplayName} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      disabled={isSavingName}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-brand disabled:bg-slate-100"
                    />
                    <button
                      type="submit"
                      disabled={isSavingName}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
                    >
                      {isSavingName ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          Menyimpan...
                        </>
                      ) : (
                        'Simpan'
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isSavingName}
                      onClick={() => {
                        setEditingName(false);
                        setNameError('');
                      }}
                      className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 disabled:opacity-60"
                    >
                      Batal
                    </button>
                  </div>
                  {nameError && <p className="text-xs text-bad-text">{nameError}</p>}
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-extrabold text-slate-900">{currentUser}</h1>
                  <button
                    type="button"
                    onClick={() => {
                      setNewName(currentUser);
                      setEditingName(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Edit3 className="size-3.5" aria-hidden="true" /> Ubah nama
                  </button>
                </div>
              )}

              <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <EyeOff className="size-4 text-slate-500" aria-hidden="true" />
                  Email privat: <b className="text-slate-800">{userProfile.email}</b> (hanya terlihat oleh Anda)
                </span>
                {userProfile.emailVerified && (
                  <span className="inline-flex items-center gap-1 font-semibold text-ok-text">
                    <CheckCircle2 className="size-4" aria-hidden="true" /> Email terverifikasi
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('lapor')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark"
            >
              <Plus className="size-4" aria-hidden="true" /> Buat Pengaduan
            </button>
            <button
              type="button"
              id="profile-logout"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <LogOut className="size-4" aria-hidden="true" /> Keluar
            </button>
          </div>
        </div>

        {/* Statistik Ringkas */}
        <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-slate-100 pt-6">
          <div className="border-l-2 border-brand pl-4">
            <dt className="text-sm text-slate-600">Laporan Kondisi</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {activeReports.length}{' '}
              <span className="text-sm font-medium text-slate-600">
                ({activeReports.filter((r) => r.status === 'draft').length} draf)
              </span>
            </dd>
          </div>
          <div className="border-l-2 border-amber-500 pl-4">
            <dt className="text-sm text-slate-600">Usulan Klaim Lokasi</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {myClaims.length}
            </dd>
          </div>
          <div className="border-l-2 border-emerald-600 pl-4">
            <dt className="text-sm text-slate-600">Suara Verifikasi</dt>
            <dd className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">
              {voteHistory.length}
            </dd>
          </div>
        </dl>
      </section>

      {/* Navigasi Tab */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Riwayat kiriman warga"
          className="grid w-full grid-cols-1 gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 sm:inline-flex sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'laporan'}
            onClick={() => setTab('laporan')}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === 'laporan' ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Laporan Saya ({activeReports.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'klaim'}
            onClick={() => setTab('klaim')}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === 'klaim' ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Klaim Lokasi ({myClaims.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'suara'}
            onClick={() => setTab('suara')}
            className={`flex min-w-0 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === 'suara' ? 'bg-brand text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">Riwayat Suara ({voteHistory.length})</span>
          </button>
        </div>

        {/* Filter Status per Tab */}
        {tab === 'laporan' && (
          <select
            aria-label="Filter status laporan saya"
            value={reportFilter}
            onChange={(e) => setReportFilter(e.target.value as 'semua' | ReportStatus)}
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand"
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
            className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-brand"
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
        <ul className="space-y-4">
          {loadingReports ? (
            <li className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
              <Loader2 className="mb-3 size-8 animate-spin text-brand" aria-hidden="true" />
              <p className="text-base font-bold text-slate-900">Memuat laporan Anda...</p>
              <p className="mt-1 text-sm text-slate-600">Mengambil riwayat laporan dari server.</p>
            </li>
          ) : filteredReports.length === 0 ? (
            <EmptyBox text="Belum ada laporan kondisi pada filter ini." />
          ) : (
            filteredReports.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                        {REPORT_CATEGORY_LABELS[r.category]}
                      </span>
                      {r.spseCode && <span className="font-mono text-slate-600">#{r.spseCode}</span>}
                      <span className="text-slate-500">· {r.createdAt}</span>
                    </div>
                    <h2 className="mt-1.5 text-lg font-bold text-slate-900">{r.projectTitle}</h2>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <p className="mt-3 text-base leading-relaxed text-slate-700">{r.narrative}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  {r.proposedAddress && (
                    <span className="flex items-center gap-1.5 truncate">
                      <MapPin className="size-4 shrink-0 text-slate-500" aria-hidden="true" />
                      <span>{r.proposedAddress}</span>
                    </span>
                  )}
                  {r.distanceFromProject && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      <MapPinCheck className="size-3.5 text-brand" aria-hidden="true" />
                      {r.distanceFromProject}
                    </span>
                  )}
                  {typeof r.exifValid === 'boolean' && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.exifValid
                          ? 'bg-ok-bg text-ok-text'
                          : 'bg-wait-bg text-wait-text'
                      }`}
                    >
                      {r.exifValid ? 'Geotag Cocok' : 'EXIF Tidak Cocok'}
                    </span>
                  )}
                </div>

                {/* Galeri Pratinjau Foto Bukti Lapangan */}
                {r.photoUrls && r.photoUrls.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    {r.photoUrls.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative size-16 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 sm:size-20"
                      >
                        <img
                          src={url}
                          alt={`Bukti lapangan ${idx + 1}`}
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => navigate('detail', r.projectId)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" /> Buka Detail Proyek SPSE
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    {r.status === 'draft' && (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditDraft(r.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-brand-dark"
                        >
                          <Edit3 className="size-3.5" aria-hidden="true" /> Edit & Kirim Draf
                        </button>
                        <button
                          type="button"
                          disabled={deletingReportId === r.id}
                          onClick={() => handleDeleteReport(r.id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-bad-border/40 bg-bad-bg px-3.5 py-2 text-xs font-semibold text-bad-text hover:brightness-95 disabled:opacity-60"
                        >
                          {deletingReportId === r.id ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          )}
                          Hapus Draf
                        </button>
                      </>
                    )}

                    {r.status === 'menunggu' && (
                      <button
                        type="button"
                        disabled={deletingReportId === r.id}
                        onClick={() => handleDeleteReport(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        {deletingReportId === r.id ? (
                          <Loader2 className="size-3.5 animate-spin text-bad-text" aria-hidden="true" />
                        ) : (
                          <Trash2 className="size-3.5 text-bad-text" aria-hidden="true" />
                        )}
                        Tarik Kembali Laporan
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
        <ul className="space-y-4">
          {filteredClaims.length === 0 ? (
            <EmptyBox text="Belum ada klaim lokasi pada filter ini." />
          ) : (
            filteredClaims.map((c) => (
              <li key={c.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-semibold capitalize text-slate-700">
                        Presisi: {c.proposedPrecision}
                      </span>
                      <span className="font-mono text-slate-600">#{c.spseCode}</span>
                      <span className="text-slate-500">· {c.createdAt}</span>
                    </div>
                    <h2 className="mt-1.5 text-lg font-bold text-slate-900">{c.projectTitle}</h2>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <p className="mt-3 text-base text-slate-700">{c.proposedAddress}</p>

                {c.status === 'diterima' && (
                  <p className="mt-3 rounded-xl bg-ok-bg px-3.5 py-2.5 text-sm font-medium text-ok-text">
                    Klaim lokasi ini sudah terverifikasi dan menjadi lokasi kanonik paket.
                  </p>
                )}

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => navigate('detail', c.projectId)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" /> Buka Detail Proyek SPSE
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Isi Tab 3: Riwayat Suara Saya */}
      {tab === 'suara' && (
        <ul className="space-y-4">
          {voteHistory.length === 0 ? (
            <EmptyBox text="Anda belum memberikan suara verifikasi pada kiriman warga lain." />
          ) : (
            voteHistory.map((v, idx) => (
              <li
                key={`${v.itemId}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ${
                      v.choice === 'setuju' ? 'bg-ok-bg text-ok-text' : 'bg-bad-bg text-bad-text'
                    }`}
                  >
                    {v.choice === 'setuju' ? (
                      <ThumbsUp className="size-4" aria-hidden="true" />
                    ) : (
                      <ThumbsDown className="size-4" aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="text-base font-bold text-slate-900">{v.projectTitle}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {v.itemType === 'klaim_lokasi' ? 'Klaim Lokasi' : 'Laporan Kondisi'} oleh{' '}
                      <b className="text-slate-800">{v.authorDisplayName}</b> · {v.votedAt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-lg px-3 py-1 text-xs font-semibold ${
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
    <li className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
      <span className="mb-3 grid size-12 place-items-center rounded-full bg-slate-100">
        <ClipboardList className="size-6 text-slate-500" aria-hidden="true" />
      </span>
      <p className="text-base font-bold text-slate-900">Belum ada data</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </li>
  );
}
