import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, ImagePlus, Info, MapPinned, Send } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { WARTA_PROJECTS, getProject } from '../../data/wartaData';
import type { CitizenClaim, PrecisionLevel, VerificationItem } from '../../types/warta';
import ExifCheckBadge, { EXIF_INVALID_TEXT, EXIF_VALID_TEXT } from '../common/ExifCheckBadge';
import MiniPinMap from '../map/MiniPinMap';

const LEVELS: { v: PrecisionLevel; l: string }[] = [
  { v: 'titik', l: 'Titik Pasti Koordinat' },
  { v: 'alamat/ruas', l: 'Ruas Jalan / Alamat' },
  { v: 'desa/kelurahan', l: 'Kelurahan / Desa' },
  { v: 'kecamatan', l: 'Kecamatan' },
];

export default function ClaimLocationView() {
  const { selectedProjectId, navigate, addClaim, currentUser, setLoginOpen } = useWarta();
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
    const proposed = [address, kelurahan && `Kel. ${kelurahan}`, `Kec. ${kecamatan}`, landmark && `(dekat ${landmark})`].filter(Boolean).join(', ');
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
      distanceFromProject: 'Dalam area perkiraan SPSE',
      exifValid,
      exifNotice: exifValid ? EXIF_VALID_TEXT : EXIF_INVALID_TEXT,
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
      <div className="mx-auto w-full max-w-lg flex-1 p-4">
        <div className="animate-pop rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <MapPinned className="mx-auto mb-3 size-12 text-action-border" />
          <h1 className="mb-1 text-xl font-bold">Klaim lokasi terkirim</h1>
          <p className="mb-6 text-sm text-slate-600">Menunggu persetujuan 3 warga di sekitar lokasi.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button id="claim-done-profile" onClick={() => navigate('profil')} className="flex-1 rounded-xl border border-slate-300 py-2.5 font-semibold">Lihat di Profil</button>
            <button id="claim-done-map" onClick={() => navigate('peta')} className="flex-1 rounded-xl bg-brand py-2.5 font-semibold text-white">Kembali ke Peta</button>
          </div>
        </div>
      </div>
    );

  const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-action-border';

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl flex-1 space-y-4 p-4" noValidate>
      <button type="button" id="claim-back" onClick={() => navigate('detail', p.id)} className="flex items-center gap-1 text-sm font-semibold text-action-border hover:underline">
        <ArrowLeft className="size-4" /> Kembali ke detail
      </button>
      <h1 className="text-2xl font-extrabold">Klaim Lokasi Proyek</h1>

      <div className="rounded-2xl border border-brand-dark bg-brand p-4 text-white">
        <p className="font-bold">{p.title}</p>
        <p className="font-mono text-sm text-sky-100">#{p.spseCode} • Pagu {p.paguCompact}</p>
        <p className="mt-1 text-sm text-sky-100">{p.precisionBadge} — {p.locationDesc}</p>
        {p.precisionMicrocopy && <p className="mt-2 rounded-lg bg-white/10 p-2 text-sm">{p.precisionMicrocopy}</p>}
      </div>

      {errors.length > 0 && (
        <ul role="alert" className="list-inside list-disc rounded-xl border border-bad-border bg-bad-bg p-3 text-sm text-bad-text">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <fieldset className="rounded-2xl border border-slate-200 bg-white p-4">
        <legend className="px-1 text-sm font-bold">1. Tingkat presisi baru</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LEVELS.map((l) => (
            <label key={l.v} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm ${level === l.v ? 'border-action-border bg-action-bg font-semibold text-action-text' : 'border-slate-200'}`}>
              <input id={`level-${l.v.replace('/', '-')}`} type="radio" checked={level === l.v} onChange={() => setLevel(l.v)} className="accent-brand" />
              {l.l}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <p className="text-sm font-bold sm:col-span-2">2. Detail alamat</p>
        <input id="claim-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alamat spesifik / nama jalan" className={`${input} sm:col-span-2`} />
        <input id="claim-kelurahan" value={kelurahan} onChange={(e) => setKelurahan(e.target.value)} placeholder="Kelurahan" className={input} />
        <input id="claim-kecamatan" value={kecamatan} onChange={(e) => setKecamatan(e.target.value)} placeholder="Kecamatan *" className={input} />
        <input id="claim-landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} placeholder="Patokan fisik (mis. depan masjid)" className={`${input} sm:col-span-2`} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-bold">3. Foto papan proyek</p>
        {photo ? (
          <img src={photo} alt="Foto papan proyek" className="mb-2 h-48 w-full rounded-xl object-cover" />
        ) : (
          <label className="mb-2 flex h-32 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-action-border bg-action-bg text-sm font-semibold text-action-text">
            <ImagePlus className="size-6" /> Unggah foto
            <input id="claim-photo" type="file" accept="image/*" onChange={onFile} className="sr-only" />
          </label>
        )}
        {photo && (
          <>
            <ExifCheckBadge valid={exifValid} />
            <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <input id="claim-sim-exif" type="checkbox" checked={!exifValid} onChange={(e) => setExifValid(!e.target.checked)} />
              Simulasikan foto tanpa geotag
            </label>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-2 text-sm font-bold">4. Bandingkan lokasi</p>
        <MiniPinMap value={pin} onChange={setPin} estimate={{ x: 50, y: 50, r: 28 }} label="Abu-abu putus-putus: estimasi kota SPSE • Pin biru: usulan Anda" />
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-ok-border bg-ok-bg p-4 text-sm text-ok-text">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p>Jika 3 warga di sekitar lokasi menyetujui klaim ini, sistem otomatis memperbarui lokasi utama proyek menjadi titik pilihan warga, dengan penanda <b>Sumber: Warga</b>.</p>
          <p className="font-semibold">Setelah disetujui, akan tampil: "Klaim lokasi ini sudah terverifikasi dan menjadi lokasi kanonik paket."</p>
        </div>
      </div>

      <button type="submit" id="claim-submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white hover:bg-brand-dark">
        <Send className="size-4" /> Kirim Klaim Lokasi
      </button>
    </form>
  );
}
