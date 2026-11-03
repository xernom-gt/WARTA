import { ArrowUpRight, Database, Landmark, Users } from 'lucide-react';

interface Props {
  appUrl?: string;
}

export default function LandingFooter({ appUrl = 'http://localhost:5173' }: Props) {
  return (
    <footer className="mt-auto border-t border-brand-dark bg-brand text-white">
      {/* Banner CTA Penutup */}
      <div className="border-b border-white/10 bg-brand-dark/50">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-10 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-black sm:text-2xl">
              Siap Memantau Proyek Konstruksi di Sekitar Lingkunganmu?
            </h2>
            <p className="mt-1 text-sm text-sky-200">
              Cek peta proyek SPSE DKI Jakarta, klaim titik lokasi yang masih tingkat kota, atau bantu verifikasi laporan warga.
            </p>
          </div>
          <a
            href={appUrl}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-action-border bg-action-bg px-5 py-3 text-sm font-extrabold text-action-text shadow transition hover:bg-white"
          >
            Buka Aplikasi WARTA <ArrowUpRight className="size-4" />
          </a>
        </div>
      </div>

      {/* Info Sumber */}
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-xs text-sky-200 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Landmark className="size-4 text-sky-300" />
          <span className="font-bold text-white">WARTA</span>
          <span>— Warga Pantau Proyek di Depan Rumahmu</span>
        </div>
        <p className="flex items-center gap-1.5">
          <Database className="size-3.5" /> Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.
        </p>
        <p className="flex items-center gap-1.5">
          <Users className="size-3.5" /> Tanpa admin — status berubah otomatis lewat 3 suara warga.
        </p>
      </div>
    </footer>
  );
}
