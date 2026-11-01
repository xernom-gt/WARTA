import { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  CloudOff,
  Map,
  MapPinned,
  ShieldAlert,
  Users,
} from 'lucide-react';
import StatusBadge from '../common/StatusBadge';

const STEPS = [
  {
    step: '01',
    screen: 'Layar A & B — Peta Proyek & Detail Paket',
    title: 'Telusuri Proyek di Sekitar Rumahmu',
    icon: Map,
    summary:
      'Cari berdasarkan nama paket, kode tender SPSE (#10091309000, #52764127), tahun APBD (2022–2027), atau presisi lokasi.',
    points: [
      'Lingkaran garis putus-putus menandakan Area Perkiraan (Tingkat Kota/Kelurahan), sedangkan Pin menandakan Titik Pasti.',
      'Dilengkapi inset Kepulauan Seribu (Pulau Pramuka) & penanda proyek APBD DKI di luar wilayah (TPST Bantargebang, Bekasi).',
      'Lihat kartu anggaran 3 kolom (Pagu, HPS, Kontrak), indikator risiko objektif, tab sub-lokasi sekolah/kelurahan, dan riwayat tender gagal.',
    ],
    microcopy: 'Sumber: SPSE/INAPROC. Diambil: 15 Maret 2025.',
  },
  {
    step: '02',
    screen: 'Layar C — Form Laporan Kondisi',
    title: 'Laporkan Kondisi Fisik atau Simpan Draft Offline',
    icon: Camera,
    summary:
      'Setiap laporan wajib terikat pada satu paket SPSE agar bukti lapangan tertata rapi dan dapat dipertanggungjawabkan.',
    points: [
      'Pilih 1 dari 5 kategori temuan: Proyek belum mulai, Progres lambat / mangkrak, Kualitas fisik rusak / retak, Papan proyek tidak ada, atau Proyek sudah selesai.',
      'Unggah foto bukti lapangan dengan pemeriksaan otomatis metadata koordinat EXIF Geotag.',
      'Sinyal lemah di lokasi proyek? Gunakan tombol "Simpan Draft Offline" untuk menyimpan laporan di perangkat dan kirim belakangan.',
    ],
    microcopy: 'Laporan selalu terikat pada satu paket. Tidak ada laporan lepas.',
  },
  {
    step: '03',
    screen: 'Layar E — Klaim Lokasi Kanonik',
    title: 'Perbaiki Titik Proyek yang Masih Tingkat Kota',
    icon: MapPinned,
    summary:
      'Untuk 91 paket yang lokasinya baru sebatas nama kota, warga sekitar dapat mengusulkan titik koordinat atau alamat jalan yang presisi.',
    points: [
      'Pilih tingkat presisi baru (Titik Pasti Koordinat, Ruas Jalan / Alamat, Kelurahan, atau Kecamatan) beserta patokan fisik.',
      'Bandingkan langsung lingkaran abu-abu estimasi kota SPSE dengan pin biru usulan warga di atas peta.',
      'Unggah foto papan proyek di lapangan sebagai bukti penentuan titik lokasi utama.',
    ],
    microcopy: 'Klaim lokasi ini sudah terverifikasi dan menjadi lokasi kanonik paket.',
  },
  {
    step: '04',
    screen: 'Layar D & F — Verifikasi Warga & Profil Aktivitas',
    title: 'Konsensus 3 Suara Warga (Tanpa Admin)',
    icon: Users,
    summary:
      'Tidak ada moderator tunggal atau birokrasi admin. Warga sekitar memeriksa foto bukti, jarak pelapor, serta status EXIF lalu memberi suara.',
    points: [
      'Proteksi Anti-Verifikasi Mandiri: pembuat laporan/klaim tidak dapat memberi suara pada kirimannya sendiri.',
      'Setiap warga lain hanya bisa memberi 1 suara (Setuju / Tidak Setuju) per item antrean.',
      'Begitu mencapai 3 suara setuju (3/3), status laporan otomatis berubah menjadi Terverifikasi dan klaim lokasi menjadi Lokasi Kanonik.',
    ],
    microcopy: 'Status berubah otomatis setelah cukup verifikasi warga (3 suara). Tidak ada admin.',
  },
];

export default function WorkflowSection() {
  const [activeIdx, setActiveIdx] = useState(0);
  const current = STEPS[activeIdx];
  const Icon = current.icon;

  return (
    <section id="alur-kerja" className="border-y border-slate-200 bg-white py-14">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-8 max-w-3xl">
          <span className="inline-block rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            Alur Sistem Tanpa Admin
          </span>
          <h2 className="mt-2 text-2xl font-black text-slate-900 sm:text-3xl">
            Bagaimana Alur Kerja WARTA dari Data SPSE hingga Terverifikasi Warga?
          </h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            Seluruh alur dirancang selaras dengan 6 layar utama aplikasi WARTA — mulai dari eksplorasi peta hingga
            perubahan status otomatis melalui konsensus warga.
          </p>
        </div>

        {/* Pemilih 4 Langkah */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, idx) => {
            const StepIcon = s.icon;
            const active = idx === activeIdx;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`flex flex-col justify-between rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-brand bg-brand text-white shadow-lg'
                    : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-action-border hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-lg px-2 py-0.5 font-mono text-xs font-black ${
                      active ? 'bg-white/15 text-sky-200' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    LANGKAH {s.step}
                  </span>
                  <StepIcon className={`size-5 ${active ? 'text-sky-300' : 'text-brand'}`} />
                </div>
                <div className="mt-4">
                  <p className={`text-[11px] font-semibold ${active ? 'text-sky-200' : 'text-slate-500'}`}>{s.screen}</p>
                  <h3 className="mt-0.5 font-extrabold leading-snug">{s.title}</h3>
                </div>
              </button>
            );
          })}
        </div>

        {/* Panel Detail Langkah Terpilih */}
        <div className="mt-6 grid gap-6 rounded-3xl border border-slate-200 bg-slate-50 p-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full bg-action-bg px-3 py-1 text-xs font-bold text-action-text">
              <Icon className="size-4" /> {current.screen}
            </div>
            <h3 className="text-xl font-black text-slate-900 sm:text-2xl">
              Langkah {current.step}: {current.title}
            </h3>
            <p className="text-sm leading-relaxed text-slate-700 sm:text-base">{current.summary}</p>
            <ul className="space-y-2.5 pt-1">
              {current.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok-border" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-xl border border-brand/20 bg-white p-3 text-xs font-semibold text-brand">
              Prinsip Sistem: "{current.microcopy}"
            </div>
          </div>

          {/* Diagram Status Alur Laporan & Klaim */}
          <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-5">
            <div>
              <h4 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
                5 Status Siklus Laporan & Klaim Warga
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Setiap status menggunakan kombinasi ikon + label teks aksesibel sesuai token warna WARTA:
              </p>

              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <StatusBadge status="draft" size="md" />
                  <span className="text-xs text-slate-600">Disimpan offline di perangkat warga</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <StatusBadge status="menunggu" size="md" />
                  <span className="text-xs text-slate-600">Masuk antrean (0/3 hingga 2/3 suara)</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <StatusBadge status="terverifikasi" size="md" />
                  <span className="text-xs text-slate-600">Mencapai 3/3 suara setuju warga</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <StatusBadge status="ditolak" size="md" />
                  <span className="text-xs text-slate-600">3 warga menyatakan bukti tidak akurat</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                  <StatusBadge status="selesai" size="md" />
                  <span className="text-xs text-slate-600">Masalah lapangan telah ditindaklanjuti</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-wait-bg/70 p-3 text-xs text-wait-text">
              <ShieldAlert className="size-4 shrink-0" />
              <span>
                Dilengkapi mode <CloudOff className="inline size-3.5" /> <b>Draft Offline</b> & proteksi anti-verifikasi mandiri.
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
