import { ChevronDown, History } from 'lucide-react';
import type { FailedTender } from '../../types/warta';

interface Props {
  title: string;
  tenders: FailedTender[];
  currentCode: string;
}

/** Riwayat tender gagal (collapsed secara bawaan melalui elemen <details>). */
export default function TenderHistoryAccordion({ title, tenders, currentCode }: Props) {
  return (
    <details className="group rounded-xl border border-wait-border bg-wait-bg/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-semibold text-wait-text">
        <History className="size-4 shrink-0" />
        <span className="flex-1">{title}</span>
        <ChevronDown className="size-4 transition group-open:rotate-180" />
      </summary>
      <ol className="space-y-2 border-t border-wait-border/40 p-4 text-sm">
        {tenders.map((t) => (
          <li key={t.code} className="rounded-lg bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono font-semibold">#{t.code}</code>
              <span className="rounded bg-bad-bg px-2 py-0.5 text-xs font-semibold text-bad-text">{t.status}</span>
            </div>
            {t.note && <p className="mt-1 text-slate-600">{t.note}</p>}
          </li>
        ))}
        <li className="rounded-lg bg-white p-3">
          <code className="font-mono font-semibold">#{currentCode}</code>{' '}
          <span className="rounded bg-ok-bg px-2 py-0.5 text-xs font-semibold text-ok-text">Proses terbaru</span>
        </li>
      </ol>
    </details>
  );
}
