import { useMemo, useState } from 'react';
import {
  Edit3,
  ExternalLink,
  MapPin,
  PlusCircle,
  Search,
} from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import StatusBadge from '../common/StatusBadge';

export default function AdminProjectsView() {
  const { projects, setEditingProjectId, setIsCreateProjectOpen, navigate } = useWarta();

  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('semua');
  const [statusFilter, setStatusFilter] = useState('semua');

  // Filter projects
  const filteredProjects = useMemo(() => {
    const term = q.trim().toLowerCase();
    return projects.filter((p) => {
      const matchTerm =
        !term ||
        [p.title, p.spseCode, p.satker, p.locationDesc, p.category].some((v) =>
          v.toLowerCase().includes(term),
        );
      const matchCat = categoryFilter === 'semua' || p.category === categoryFilter;
      const matchStatus = statusFilter === 'semua' || p.status === statusFilter;
      return matchTerm && matchCat && matchStatus;
    });
  }, [projects, q, categoryFilter, statusFilter]);

  const categories = useMemo(() => {
    return Array.from(new Set(projects.map((p) => p.category)));
  }, [projects]);

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8 sm:px-6 sm:py-10">
      {/* 1. Header Section */}
      <section className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Pengelolaan Paket Proyek
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Perbarui status konstruksi, nilai kontrak pemenang, serta tentukan titik koordinat kanonik proyek di peta OpenStreetMap.
          </p>
        </div>

        <button
          onClick={() => setIsCreateProjectOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-brand-dark transition cursor-pointer self-start sm:self-auto"
        >
          <PlusCircle className="size-4 shrink-0" />
          + Tambah Proyek Baru
        </button>
      </section>

      {/* 2. Search & Filter Bar */}
      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs md:flex-row md:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 transition focus-within:border-brand focus-within:bg-white focus-within:ring-2 focus-within:ring-brand/20">
          <Search className="size-4 shrink-0 text-slate-500" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari nama paket proyek, kode tender SPSE, dinas satker, atau lokasi..."
            className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
          />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-brand"
          >
            <option value="semua">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 outline-none focus:border-brand"
          >
            <option value="semua">Semua Status</option>
            <option value="menunggu">Tahap Perencanaan / Lelang</option>
            <option value="terverifikasi">Konstruksi Berjalan</option>
            <option value="selesai">Pekerjaan Selesai</option>
            <option value="ditolak">Dibatalkan / Mangkrak</option>
          </select>
        </div>
      </section>

      {/* 3. Daftar Proyek (Card Grid) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
          <span>Menampilkan {filteredProjects.length} dari {projects.length} paket pekerjaan</span>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
            <Search className="size-10 text-slate-300 mb-3" />
            <h3 className="text-base font-bold text-slate-800">Tidak ada paket proyek yang cocok</h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Coba sesuaikan kata kunci pencarian atau reset filter kategori/status di atas.
            </p>
            {(q || categoryFilter !== 'semua' || statusFilter !== 'semua') && (
              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setCategoryFilter('semua');
                  setStatusFilter('semua');
                }}
                className="mt-4 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand-dark transition cursor-pointer"
              >
                Reset Filter Pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((p) => (
              <article
                key={p.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 hover:shadow-md transition"
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <StatusBadge status={p.status} />
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                      {p.category}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 line-clamp-2">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500 truncate">
                      {p.satker}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Pagu Anggaran</span>
                      <span className="font-extrabold text-brand tabular-nums">
                        {p.paguCompact}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">Nilai Kontrak</span>
                      <span className="font-semibold text-slate-800 tabular-nums">
                        {p.kontrakCompact ?? 'Belum terbit'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin className="size-3.5 shrink-0 text-brand" />
                      <span className="truncate">{p.locationDesc}</span>
                    </p>
                    <p className="font-mono text-[11px] text-slate-400">
                      GPS: {p.mapCoordinates?.lat?.toFixed(5) ?? '-'}, {p.mapCoordinates?.lng?.toFixed(5) ?? '-'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingProjectId(p.id)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand/10 py-2.5 text-xs font-bold text-brand hover:bg-brand hover:text-white transition cursor-pointer"
                  >
                    <Edit3 className="size-3.5" />
                    Edit Proyek
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('peta', p.id)}
                    title="Lihat posisi di peta pengawasan"
                    className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
                  >
                    <ExternalLink className="size-3.5" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
