import { useEffect, useMemo } from 'react';
import {
  ArrowRight,
  BadgeAlert,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Map,
  PlusCircle,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { dtoToItem, verificationService } from '../../services/verification';
import StatusBadge from '../common/StatusBadge';

export default function AdminDashboardView() {
  const { queue, projects, navigate, setIsCreateProjectOpen, setQueue } = useWarta();

  useEffect(() => {
    verificationService
      .getQueue()
      .then((res) => {
        if (res.data && res.data.length > 0) {
          const fetched = res.data.map(dtoToItem);
          const merged = fetched.map((item) => {
            const local = queue.find((q) => q.id === item.id);
            if (
              local &&
              (local.status === 'selesai' ||
                local.status === 'terverifikasi' ||
                local.status === 'ditolak' ||
                local.adminNote)
            ) {
              return {
                ...item,
                status: local.status,
                adminNote: local.adminNote ?? item.adminNote,
              };
            }
            return item;
          });
          setQueue(merged);
        }
      })
      .catch(() => {
        // Abaikan jika offline / error
      });
  }, [setQueue, queue]);

  // Hitung KPI Eksekutif
  const metrics = useMemo(() => {
    const totalReports = queue.length;
    const pendingReports = queue.filter((it) => it.status === 'menunggu').length;
    const inProgressReports = queue.filter(
      (it) => it.status === 'terverifikasi' || (it.status as string) === 'diproses',
    ).length;
    const resolvedReports = queue.filter((it) => it.status === 'selesai').length;
    const totalProjects = projects.length;

    // Aduan prioritas: Urutkan berdasarkan votesAgree tertinggi
    const priorityReports = [...queue]
      .filter((it) => it.status === 'menunggu' || (it.status as string) === 'diproses')
      .sort((a, b) => b.votesAgree - a.votesAgree)
      .slice(0, 4);

    return {
      totalReports,
      pendingReports,
      inProgressReports,
      resolvedReports,
      totalProjects,
      priorityReports,
    };
  }, [queue, projects]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-8 sm:px-6 sm:py-10">
      {/* 1. Header Dashboard Eksekutif */}
      <section className="flex flex-col justify-between gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-lg bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
            <TrendingUp className="size-3.5" />
            Portal Pengawasan & Tindak Lanjut Instansi
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Dashboard Evaluasi & Aspirasi
          </h1>
          <p className="text-base text-slate-600">
            Pantau dan tindak lanjuti laporan kondisi fisik fasilitas publik dari warga serta kelola paket proyek APBD secara transparan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsCreateProjectOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-brand-dark transition cursor-pointer"
          >
            <PlusCircle className="size-4 shrink-0" />
            + Tambah Proyek APBD
          </button>
          <button
            onClick={() => navigate('peta')}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition cursor-pointer"
          >
            <Map className="size-4 shrink-0 text-brand" />
            Peta Pengawasan
          </button>
        </div>
      </section>

      {/* 2. Empat Kartu KPI Eksekutif */}
      <section aria-label="Statistik KPI Ringkas" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Total Aduan Masuk */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Aduan Masuk
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-slate-100 text-slate-700">
              <FileText className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900 tabular-nums">
            {metrics.totalReports}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Dari seluruh warga kota
          </p>
        </div>

        {/* Menunggu Verifikasi / Kuorum */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Menunggu Tindak Lanjut
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-amber-100 text-amber-700">
              <Clock className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-amber-900 tabular-nums">
            {metrics.pendingReports}
          </p>
          <p className="mt-1 text-xs font-medium text-amber-700">
            Aduan perlu verifikasi dinas
          </p>
        </div>

        {/* Sedang Diproses */}
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800">
              Sedang Ditangani
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-sky-100 text-sky-700">
              <BadgeAlert className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-sky-900 tabular-nums">
            {metrics.inProgressReports}
          </p>
          <p className="mt-1 text-xs font-medium text-sky-700">
            Konstruksi & perbaikan fisik
          </p>
        </div>

        {/* Selesai / Rampung */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Penanganan Selesai
            </span>
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-4" />
            </span>
          </div>
          <p className="mt-3 text-3xl font-black text-emerald-900 tabular-nums">
            {metrics.resolvedReports}
          </p>
          <p className="mt-1 text-xs font-medium text-emerald-700">
            Fasilitas telah diperbaiki
          </p>
        </div>
      </section>

      {/* 3. Panel Prioritas Komunitas & Monitoring Proyek */}
      <section className="grid gap-8 lg:grid-cols-3">
        {/* Kolom Kiri & Tengah: Aduan Prioritas Tertinggi Berdasarkan Vote Warga */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 sm:text-xl">
                Aduan Prioritas Komunitas (Dukungan Warga Tertinggi)
              </h2>
              <p className="text-xs text-slate-500">
                Diurutkan berdasarkan jumlah vote setuju warga untuk diprioritaskan penanganannya
              </p>
            </div>
            <button
              onClick={() => navigate('aduan')}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline cursor-pointer"
            >
              Lihat Semua <ArrowRight className="size-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {metrics.priorityReports.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                Belum ada aduan prioritas yang membutuhkan tindakan.
              </div>
            ) : (
              metrics.priorityReports.map((it) => (
                <article
                  key={it.id}
                  onClick={() => navigate('aduan')}
                  className="group flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-brand/40 hover:shadow-md transition cursor-pointer sm:flex-row sm:items-center"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700">
                        <ThumbsUp className="size-3" />
                        {it.votesAgree} Warga Setuju
                      </span>
                      <StatusBadge status={it.status} />
                      <span className="text-xs text-slate-400">
                        {it.itemType === 'klaim_lokasi' ? 'Klaim Lokasi' : it.categoryLabel}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 group-hover:text-brand transition truncate">
                      {it.projectTitle}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-2">
                      {it.narrative}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('aduan');
                      }}
                      className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-brand hover:text-white hover:border-brand transition cursor-pointer"
                    >
                      Tindak Lanjuti
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

        {/* Kolom Kanan: Ringkasan Paket Proyek APBD */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">
              Paket Proyek Dipantau
            </h2>
            <button
              onClick={() => navigate('proyek')}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline cursor-pointer"
            >
              Kelola <ArrowRight className="size-3.5" />
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                <Building2 className="size-5" />
              </span>
              <div>
                <p className="text-2xl font-black text-slate-900 tabular-nums">
                  {metrics.totalProjects} Paket
                </p>
                <p className="text-xs text-slate-500">Tercatat di data pengadaan daerah</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Wilayah DKI Jakarta & Sekitarnya</span>
                <span className="font-bold text-slate-900">{metrics.totalProjects} Proyek</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Terkonfirmasi Presisi</span>
                <span className="font-bold text-emerald-600">
                  {projects.filter((p) => p.precisionLevel === 'titik').length} Proyek
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Nilai Kontrak Terbit</span>
                <span className="font-bold text-sky-700">
                  {projects.filter((p) => p.kontrakAvailable).length} Proyek
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => navigate('proyek')}
                className="w-full rounded-xl bg-slate-100 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-200 transition cursor-pointer"
              >
                Buka Katalog & Edit Proyek
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
