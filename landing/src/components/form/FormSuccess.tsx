import { CloudOff, Send } from 'lucide-react';

interface Props {
  type: 'draft' | 'sent' | 'claim-sent';
  onMyReports: () => void;
  onFeed: () => void;
}

export default function FormSuccess({ type, onMyReports, onFeed }: Props) {
  const isDraft = type === 'draft';
  const title =
    type === 'draft'
      ? 'Draf pengaduan disimpan'
      : type === 'claim-sent'
        ? 'Klaim lokasi berhasil dikirim'
        : 'Pengaduan berhasil dikirim';

  const message =
    type === 'draft'
      ? 'Draf tersimpan di sesi ini. Anda dapat mengedit, melengkapi foto, atau mengirimnya kapan saja melalui menu Aduan Saya.'
      : 'Kiriman Anda kini berstatus Menunggu Verifikasi dan dapat dilihat oleh warga lain maupun tim verifikasi.';

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <div
          className={`mx-auto mb-4 grid size-14 place-items-center rounded-full ${
            isDraft ? 'bg-slate-100 text-slate-700' : 'bg-ok-bg text-ok-text'
          }`}
        >
          {isDraft ? (
            <CloudOff className="size-7" aria-hidden="true" />
          ) : (
            <Send className="size-7" aria-hidden="true" />
          )}
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
        <p className="mt-2 mb-8 text-base leading-relaxed text-slate-600">{message}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onMyReports}
            className="flex-1 rounded-xl border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Buka Aduan Saya
          </button>
          <button
            type="button"
            onClick={onFeed}
            className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Lihat Feed Aduan Warga
          </button>
        </div>
      </div>
    </div>
  );
}
