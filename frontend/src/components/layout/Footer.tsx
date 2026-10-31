import { Database, Users } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5"><Database className="size-3.5" />Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.</p>
        <p className="flex items-center gap-1.5"><Users className="size-3.5" />Tanpa admin — status berubah otomatis lewat 3 suara warga.</p>
      </div>
    </footer>
  );
}
