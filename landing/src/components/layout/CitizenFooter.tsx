import { Database, Landmark, ShieldCheck } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { DATASET_SUMMARY } from '../../data/wartaData';

export default function CitizenFooter() {
  const { navigate } = useWarta();

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-slate-900">
              <span className="grid size-8 place-items-center rounded-lg bg-brand text-white">
                <Landmark className="size-4" />
              </span>
              <span className="text-base font-extrabold tracking-tight">WARTA</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              Portal partisipasi warga untuk memantau realisasi fisik proyek infrastruktur di sekitar tempat tinggal berdasarkan data terbuka SPSE/INAPROC.
            </p>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-slate-900">Navigasi Cepat Pengadu</p>
            <ul className="space-y-1.5">
              <li>
                <button type="button" onClick={() => navigate('peta')} className="hover:text-brand hover:underline">
                  Jelajah Proyek & Peta SPSE
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('aduan')} className="hover:text-brand hover:underline">
                  Lihat Aduan Warga Lain & Tambah Bukti
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('lapor')} className="hover:text-brand hover:underline">
                  Buat Pengaduan Kondisi / Klaim Lokasi
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('profil')} className="hover:text-brand hover:underline">
                  Pantau Aduan Saya & Draf
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-slate-900">Transparansi & Privasi</p>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
              <Database className="mt-0.5 size-4 shrink-0 text-slate-400" />
              <span>
                Memuat <b>{DATASET_SUMMARY.uniqueProjects}</b> paket unik dari {DATASET_SUMMARY.totalRawPackages} baris SPSE (termasuk {DATASET_SUMMARY.precisionBreakdown.kabupatenKota} paket yang lokasinya masih tingkat kota).
              </span>
            </p>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" />
              <span>
                Identitas pengadu dilindungi menggunakan nama tampilan publik (`display_name`). Email pribadi tidak pernah dipublikasikan.
              </span>
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col justify-between gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500 sm:flex-row">
          <span>WARTA — Warga Pantau Proyek di Depan Rumahmu</span>
          <span>Data bersumber dari publikasi terbuka SPSE/INAPROC</span>
        </div>
      </div>
    </footer>
  );
}
