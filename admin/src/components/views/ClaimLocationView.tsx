import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, ImagePlus, Info, MapPinned, Send } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { SAMPLE_DATA, WARTA_PROJECTS, getProject } from '../../data/wartaData';
import type { CitizenClaim, PrecisionLevel, VerificationItem } from '../../types/warta';
import ExifCheckBadge, { EXIF_INVALID_TEXT, EXIF_VALID_TEXT } from '../common/ExifCheckBadge';
import MiniPinMap from '../map/MiniPinMap';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

const LEVELS: { v: PrecisionLevel; l: string }[] = [
  { v: 'titik', l: 'Titik Pasti Koordinat' },
  { v: 'alamat/ruas', l: 'Ruas Jalan / Alamat' },
  { v: 'desa/kelurahan', l: 'Kelurahan / Desa' },
  { v: 'kecamatan', l: 'Kecamatan' },
];

export default function ClaimLocationView() {
  const { selectedProjectId, selectProject, navigate, addClaim, currentUser, setLoginOpen } = useWarta();
  const fallback = WARTA_PROJECTS.find((p) => p.id === 'proj-2') ?? WARTA_PROJECTS[0];
  const p = selectedProjectId ? getProject(selectedProjectId) : fallback;

  const [level, setLevel] = useState<PrecisionLevel>('alamat/ruas');
  const [address, setAddress] = useState('');
  const [kelurahan, setKelurahan] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [landmark, setLandmark] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [exifValid, setExifValid] = useState(true);
  const [pin, setPin] = useState({ x: 62, y: 42 });
  const [errors, setErrors] = useState<string[]>([]);
  const [sent, setSent] = useState(false);

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setPhoto(URL.createObjectURL(f));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return setLoginOpen(true);
    const errs: string[] = [];
    if (!address.trim() && level !== 'kecamatan' && level !== 'desa/kelurahan') errs.push('Isi alamat spesifik.');
    if (!kecamatan.trim()) errs.push('Isi kecamatan.');
    if (!photo) errs.push('Unggah foto papan proyek.');
    setErrors(errs);
    if (errs.length || !photo) return;
    const proposed = [
      address,
      kelurahan && `Kel. ${kelurahan}`,
      `Kec. ${kecamatan}`,
      landmark && `(dekat ${landmark})`,
    ]
      .filter(Boolean)
      .join(', ');
    const claim: CitizenClaim = {
      id: `clm-${Date.now()}`,
      projectId: p.id,
      projectTitle: p.title,
      spseCode: p.spseCode,
      proposedAddress: proposed,
      proposedPrecision: level,
      createdAt: 'Baru saja',
      status: 'menunggu',
    };
    const item: VerificationItem = {
      id: `ver-${Date.now()}`,
      projectId: p.id,
      projectTitle: p.title,
      spseCode: p.spseCode,
      satker: p.satker,
      paguCompact: p.paguCompact,
      itemType: 'klaim_lokasi',
      categoryLabel: 'Klaim Lokasi Kanonik',
      authorDisplayName: currentUser,
      createdAt: 'Baru saja',
      distanceFromProject: SAMPLE_DATA ? 'Dalam area perkiraan SPSE' : undefined,
      exifValid: SAMPLE_DATA ? exifValid : undefined,
      exifNotice: SAMPLE_DATA ? (exifValid ? EXIF_VALID_TEXT : EXIF_INVALID_TEXT) : undefined,
      narrative: landmark ? `Patokan: ${landmark}` : 'Klaim titik lokasi proyek.',
      proposedAddress: proposed,
      proposedPrecision: level,
      coordinates: { lat: -6.1 - pin.y / 1000, lng: 106.8 + pin.x / 1000 },
      photoUrl: photo,
      votesAgree: 0,
      votesDisagree: 0,
      targetVotes: 3,
      voters: [],
      status: 'menunggu',
    };
    addClaim(claim, item);
    setSent(true);
  };

  if (sent)
    return (
      <div className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        <div className="animate-pop rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <MapPinned className="mx-auto mb-3 size-12 text-action-border" />
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Klaim lokasi terkirim</h1>
          <p className="mb-6 text-base text-slate-600">Menunggu persetujuan 3 warga di sekitar lokasi.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              id="claim-done-profile"
              onClick={() => navigate('profil')}
              className="flex-1 rounded-xl border border-slate-300 py-3 font-semibold text-slate-800 hover:bg-slate-50"
            >
              Lihat di Profil
            </button>
            <button
              id="claim-done-feed"
              onClick={() => navigate('verifikasi')}
              className="flex-1 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-dark"
            >
              Lihat Antrean Aduan
            </button>
          </div>
        </div>
      </div>
    );

  const input =
    'w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-action-border focus:ring-2 focus:ring-action-border/30';

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-10 sm:px-6 sm:py-12"
      noValidate
    >
      <button
        type="button"
        id="claim-back"
        onClick={() => navigate('detail', p.id)}
        className="flex items-center gap-1.5 text-sm font-semibold text-action-border hover:underline"
      >
        <ArrowLeft className="size-4" /> Kembali ke detail proyek
      </button>

      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Klaim Titik Lokasi Proyek</h1>
        <p className="text-base leading-relaxed text-slate-600">
          Bantu perbaiki presisi lokasi proyek SPSE yang baru tercatat di tingkat kota atau kelurahan.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-brand-dark bg-brand p-6 text-white">
        <div className="space-y-1">
          <label htmlFor="claim-project-select" className="block text-xs font-bold tracking-wide text-sky-100 uppercase">
            Paket Proyek yang Diklaim
          </label>
          <Select value={p.id} onValueChange={(id) => selectProject(id)}>
            <SelectTrigger
              id="claim-project-select"
              aria-label="Pilih paket proyek"
              className="mt-1 h-12 border-white/25 bg-white text-base font-bold text-slate-900"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WARTA_PROJECTS.map((proj) => (
                <SelectItem key={proj.id} value={proj.id}>
                  {proj.title} (#{proj.spseCode} · {proj.paguCompact})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="font-mono text-sm text-sky-100">
          #{p.spseCode} · Pagu {p.paguCompact}
        </p>
        <p className="text-sm text-sky-100">
          {p.precisionBadge} · {p.locationDesc}
        </p>
        {p.precisionMicrocopy && <p className="rounded-xl bg-white/10 p-3 text-sm">{p.precisionMicrocopy}</p>}
      </div>

      {errors.length > 0 && (
        <ul
          role="alert"
          className="list-inside list-disc space-y-1 rounded-xl border border-bad-border bg-bad-bg p-4 text-sm font-medium text-bad-text"
        >
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-6">
        <legend className="px-1 text-base font-bold text-slate-900">1. Tingkat presisi baru</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {LEVELS.map((l) => (
            <label
              key={l.v}
              className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3.5 text-sm ${
                level === l.v
                  ? 'border-action-border bg-action-bg font-semibold text-action-text'
                  : 'border-slate-200 text-slate-800 hover:border-slate-400'
              }`}
            >
              <input
                id={`level-${l.v.replace('/', '-')}`}
                type="radio"
                checked={level === l.v}
                onChange={() => setLevel(l.v)}
                className="size-4 accent-brand"
              />
              {l.l}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
        <p className="text-base font-bold text-slate-900 sm:col-span-2">2. Detail alamat</p>
        <input
          id="claim-address"
          aria-label="Alamat spesifik atau nama jalan"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Alamat spesifik / nama jalan"
          className={`${input} sm:col-span-2`}
        />
        <input
          id="claim-kelurahan"
          aria-label="Kelurahan"
          value={kelurahan}
          onChange={(e) => setKelurahan(e.target.value)}
          placeholder="Kelurahan"
          className={input}
        />
        <input
          id="claim-kecamatan"
          aria-label="Kecamatan"
          value={kecamatan}
          onChange={(e) => setKecamatan(e.target.value)}
          placeholder="Kecamatan *"
          className={input}
        />
        <input
          id="claim-landmark"
          aria-label="Patokan fisik"
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
          placeholder="Patokan fisik (mis. depan masjid)"
          className={`${input} sm:col-span-2`}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="mb-3 text-base font-bold text-slate-900">3. Foto papan proyek *</p>
        {photo ? (
          <img src={photo} alt="Foto papan proyek" className="mb-3 h-52 w-full rounded-xl object-cover" />
        ) : (
          <label className="mb-3 flex h-36 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-action-border bg-action-bg text-sm font-semibold text-action-text hover:bg-sky-100">
            <ImagePlus className="size-6" /> Unggah foto papan proyek
            <input id="claim-photo" type="file" accept="image/*" onChange={onFile} className="sr-only" />
          </label>
        )}
        {photo && SAMPLE_DATA && (
          <div className="space-y-2">
            <ExifCheckBadge valid={exifValid} />
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                id="claim-sim-exif"
                type="checkbox"
                checked={!exifValid}
                onChange={(e) => setExifValid(!e.target.checked)}
              />
              Simulasikan foto tanpa geotag
            </label>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="mb-3 text-base font-bold text-slate-900">4. Bandingkan lokasi</p>
        <MiniPinMap
          value={pin}
          onChange={setPin}
          estimate={{ x: 50, y: 50, r: 28 }}
          label="Abu-abu putus-putus: estimasi kota SPSE · Pin biru: usulan Anda"
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-2xl border border-ok-border bg-ok-bg p-5 text-sm text-ok-text">
        <Info className="mt-0.5 size-5 shrink-0" />
        <div className="space-y-1.5">
          <p>
            Jika 3 warga di sekitar lokasi menyetujui klaim ini, sistem otomatis memperbarui lokasi utama proyek menjadi titik pilihan warga, dengan penanda <b>Sumber: Warga</b>.
          </p>
          <p className="font-semibold">
            Setelah disetujui, akan tampil: &quot;Klaim lokasi ini sudah terverifikasi dan menjadi lokasi kanonik paket.&quot;
          </p>
        </div>
      </div>

      <button
        type="submit"
        id="claim-submit"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-base font-bold text-white hover:bg-brand-dark"
      >
        <Send className="size-5" /> Kirim Klaim Lokasi
      </button>
    </form>
  );
}
