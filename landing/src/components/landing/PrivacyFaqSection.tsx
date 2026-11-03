import { ChevronDown, EyeOff, MapPinCheck, ShieldCheck, UserCheck } from 'lucide-react';

const FAQS = [
  {
    q: 'Apakah warga harus mengunggah KTP/NIK untuk melapor di WARTA?',
    a: 'Tidak. Demi privasi dan keamanan warga, WARTA tidak meminta NIK dan tidak pernah menampilkan alamat email ke publik. Warga cukup masuk menggunakan Nama Tampilan Publik (contoh: Warga_KebonJeruk).',
  },
  {
    q: 'Bagaimana laporan atau klaim lokasi bisa disetujui jika tidak ada admin?',
    a: 'WARTA menggunakan mekanisme konsensus 3 suara warga sekitar. Ketika sebuah laporan kondisi atau klaim lokasi memperoleh 3 suara "Setuju (Sesuai Lapangan)" dari warga lain (bukan pemilik laporan), statusnya otomatis berubah menjadi Terverifikasi / Diterima.',
  },
  {
    q: 'Mengapa banyak proyek di peta ditandai lingkaran garis putus-putus?',
    a: 'Karena 91 dari 118 paket di data SPSE hanya mencantumkan nama Kabupaten/Kota tanpa alamat rinci. Lingkaran putus-putus menandakan Area Perkiraan tingkat kota/kelurahan. Warga yang mengetahui posisi papan proyek di lapangan dapat mengajukan Klaim Lokasi Kanonik agar berubah menjadi Pin Titik Pasti.',
  },
  {
    q: 'Bagaimana jika di lokasi proyek tidak ada sinyal internet?',
    a: 'Form laporan WARTA menyediakan tombol "Simpan Draft Offline". Laporan beserta foto akan disimpan sebagai Draft (Lokal) di perangkat dan langsung muncul di tab Profil Warga untuk dikirim saat kembali online.',
  },
];

export default function PrivacyFaqSection() {
  return (
    <section id="privasi-faq" className="mx-auto max-w-7xl px-4 py-14">
      <div className="grid gap-8 lg:grid-cols-12">
        {/* Prinsip Privasi & Keamanan Warga */}
        <div className="space-y-4 lg:col-span-5">
          <span className="inline-block rounded-full bg-brand px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            Privasi & Keamanan Warga
          </span>
          <h2 className="text-2xl font-black text-slate-900 sm:text-3xl">
            Aman bagi Warga Pelapor, Transparan bagi Publik
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            WARTA dirancang dengan bahasa yang ramah warga tanpa jargon teknis yang membingungkan, sekaligus menjaga
            identitas pribadi pelapor tetap terlindungi.
          </p>

          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <EyeOff className="mt-0.5 size-5 shrink-0 text-brand" />
              <div className="text-sm">
                <p className="font-bold text-slate-900">Nama Tampilan Publik Tanpa Ekspos Email</p>
                <p className="text-slate-600">
                  "Nama tampilan bersifat publik. Alamat email Anda disembunyikan dan tidak pernah ditampilkan ke publik."
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <MapPinCheck className="mt-0.5 size-5 shrink-0 text-ok-border" />
              <div className="text-sm">
                <p className="font-bold text-slate-900">Validasi Bukti Foto & EXIF Geotag</p>
                <p className="text-slate-600">
                  Setiap foto laporan diperiksa kecocokan koordinat EXIF-nya dengan lokasi paket agar warga pemverifikasi
                  punya acuan objektif.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
              <UserCheck className="mt-0.5 size-5 shrink-0 text-action-border" />
              <div className="text-sm">
                <p className="font-bold text-slate-900">1 Suara per Warga & Anti-Self-Vote</p>
                <p className="text-slate-600">
                  Pembuat laporan tidak bisa memverifikasi laporannya sendiri. Setiap akun warga lain hanya dapat memberi
                  1 suara per item.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pertanyaan Umum (FAQ) */}
        <div className="space-y-3 lg:col-span-7">
          <div className="flex items-center gap-2 pb-2">
            <ShieldCheck className="size-5 text-brand" />
            <h3 className="text-lg font-extrabold text-slate-900">Pertanyaan yang Sering Diajukan (FAQ)</h3>
          </div>

          {FAQS.map((f, idx) => (
            <details
              key={f.q}
              open={idx === 0}
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold text-slate-900">
                <span>{f.q}</span>
                <ChevronDown className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
              </summary>
              <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-sm leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
