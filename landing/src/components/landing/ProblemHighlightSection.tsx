import { AlertTriangle, FileQuestion, GitMerge, MapPinOff } from 'lucide-react';
import { DATASET_SUMMARY } from '../../data/wartaData';

const PROBLEMS = [
  {
    icon: MapPinOff,
    stat: `${DATASET_SUMMARY.precisionBreakdown.kabupatenKota} dari ${DATASET_SUMMARY.uniqueProjects} Paket`,
    badge: 'Presisi Lokasi Rendah',
    title: 'Lokasi Hanya Tertulis Tingkat Kabupaten/Kota',
    desc: 'Mayoritas data SPSE hanya mencantumkan nama kota administrasi tanpa alamat jalan atau koordinat. WARTA membedakan lingkaran area perkiraan bergaris putus-putus dengan Pin Titik Pasti, lalu membuka fitur Klaim Lokasi Kanonik oleh warga sekitar.',
    microcopy: '"Lokasi ini baru tingkat kota. Titik di peta adalah perkiraan area, bukan lokasi pasti."',
    tone: 'wait' as const,
  },
  {
    icon: FileQuestion,
    stat: `${DATASET_SUMMARY.missingContractCount} Paket Proyek`,
    badge: 'Transparansi Anggaran',
    title: 'Nilai Kontrak Belum Tersedia di Sumber Publik',
    desc: 'Alih-alih menampilkan angka Rp0 yang menyesatkan, WARTA menampilkan Pagu serta HPS secara berdampingan dan memberikan keterangan jujur ketika nilai kontrak belum dipublikasikan di SPSE.',
    microcopy: '"Nilai kontrak belum tersedia di sumber publik."',
    tone: 'action' as const,
  },
  {
    icon: GitMerge,
    stat: `${DATASET_SUMMARY.duplicateGroupsMerged} Grup (${DATASET_SUMMARY.duplicateRowsCount} Baris)`,
    badge: 'Deduplikasi & Riwayat Tender',
    title: 'Tender Gagal & Diulang dengan Kode Baru',
    desc: 'Dari 122 baris paket mentah, WARTA menggabungkan baris duplikat akibat tender ulang menjadi 118 proyek unik, sambil tetap menyimpan riwayat kode tender yang gagal dan mengambil alamat paling presisi.',
    microcopy: '"Tender ulang: percobaan sebelumnya gagal. Menampilkan proses terbaru."',
    tone: 'wait' as const,
  },
  {
    icon: AlertTriangle,
    stat: `${DATASET_SUMMARY.multiLocationPackages} Multi-Lokasi • ${DATASET_SUMMARY.multiYearPackages} Multi-Tahun`,
    badge: 'Paket Kompleks',
    title: '1 Paket Mencakup Banyak Sekolah / Kelurahan Lintas Tahun',
    desc: 'Contohnya Rehab Total Gedung Sekolah Paket 3 (Rp349,04 miliar) yang menggabungkan 6 sekolah di 5 titik berbeda, atau proyek air limbah lintas 5 tahun anggaran (2022–2026).',
    microcopy: '"Paket ini memiliki 5 lokasi. Pilih lokasi untuk melihat detail."',
    tone: 'ok' as const,
  },
];

export default function ProblemHighlightSection() {
  return (
    <section id="masalah-data" className="mx-auto max-w-7xl px-4 py-14">
      <div className="mb-8 max-w-3xl">
        <span className="inline-block rounded-full bg-action-bg px-3 py-1 text-xs font-bold uppercase tracking-wider text-action-text">
          Mengapa WARTA Dibutuhkan?
        </span>
        <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
          Temuan Nyata dari {DATASET_SUMMARY.totalRawPackages} Baris Data Pengadaan SPSE DKI Jakarta
        </h2>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Data pengadaan publik sering kali sulit dipahami warga biasa karena lokasi yang masih kasar, tender ulang yang
          terpecah, hingga nilai kontrak yang belum terbit. WARTA mengolah dan menyajikannya secara transparan.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PROBLEMS.map((item) => {
          const Icon = item.icon;
          const badgeCls =
            item.tone === 'wait'
              ? 'bg-wait-bg border-wait-border text-wait-text'
              : item.tone === 'ok'
                ? 'bg-ok-bg border-ok-border text-ok-text'
                : 'bg-action-bg border-action-border text-action-text';
          return (
            <article
              key={item.title}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${badgeCls}`}>
                    <Icon className="size-3.5" /> {item.badge}
                  </span>
                  <span className="font-mono text-xs font-extrabold text-brand">{item.stat}</span>
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </div>

              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium italic text-slate-700">
                Microcopy sistem: {item.microcopy}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
