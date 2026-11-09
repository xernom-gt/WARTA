import { Database, Users } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-center gap-2">
          <Database className="size-4 shrink-0 text-slate-500" />
          Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.
        </p>
        <p className="flex items-center gap-2">
          <Users className="size-4 shrink-0 text-slate-500" />
          Tanpa admin: status berubah otomatis lewat kuorum 3 suara warga.
        </p>
      </div>
    </footer>
  );
}
