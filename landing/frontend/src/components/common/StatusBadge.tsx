import { CheckCircle2, Clock, CloudOff, ShieldCheck, XCircle, type LucideIcon } from 'lucide-react';
import type { ClaimStatus, ReportStatus } from '../../types/warta';

type BadgeStatus = ReportStatus | ClaimStatus;

const MAP: Record<BadgeStatus, { label: string; icon: LucideIcon; cls: string }> = {
  draft: { label: 'Draft (Lokal)', icon: CloudOff, cls: 'bg-draft-bg border-draft-border text-draft-text' },
  menunggu: { label: 'Menunggu Verifikasi', icon: Clock, cls: 'bg-wait-bg border-wait-border text-wait-text' },
  terverifikasi: { label: 'Terverifikasi', icon: CheckCircle2, cls: 'bg-ok-bg border-ok-border text-ok-text' },
  diterima: { label: 'Diterima', icon: CheckCircle2, cls: 'bg-ok-bg border-ok-border text-ok-text' },
  ditolak: { label: 'Ditolak', icon: XCircle, cls: 'bg-bad-bg border-bad-border text-bad-text' },
  selesai: { label: 'Selesai', icon: ShieldCheck, cls: 'bg-done-bg border-done-border text-done-text' },
};

interface Props {
  status: BadgeStatus;
  size?: 'sm' | 'md';
}

/** Badge aksesibel: selalu Ikon + Label teks (tidak hanya mengandalkan warna). */
export default function StatusBadge({ status, size = 'sm' }: Props) {
  const { label, icon: Icon, cls } = MAP[status];
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap ${cls} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      <Icon aria-hidden className={size === 'sm' ? 'size-3.5' : 'size-4'} />
      {label}
    </span>
  );
}
