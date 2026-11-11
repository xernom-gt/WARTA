import { useEffect, useState } from 'react';
import { Building2, Check, MapPin, Save, Trash2, X } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import { WARTA_PROJECTS } from '../../data/wartaData';
import type { PrecisionLevel, ProjectPackage, ReportStatus } from '../../types/warta';
import MiniPinMap, { type MiniPinValue } from '../map/MiniPinMap';

const CATEGORIES = [
  'Gedung & Permukiman',
  'Jalan & Jembatan',
  'Drainase & Pengendali Banjir',
  'Sarana Pendidikan & Olahraga',
  'Sarana Kesehatan',
  'Fasilitas Publik & Taman',
  'Ornamen & Penataan Kota',
];

const STATUS_OPTIONS: { value: ReportStatus; label: string }[] = [
  { value: 'menunggu', label: 'Tahap Perencanaan / Lelang' },
  { value: 'terverifikasi', label: 'Konstruksi Berjalan (Aktif)' },
  { value: 'selesai', label: 'Pekerjaan Selesai & Diresmikan' },
  { value: 'ditolak', label: 'Dibatalkan / Mangkrak' },
];

const PRECISION_OPTIONS: { value: PrecisionLevel; label: string }[] = [
  { value: 'titik', label: 'Titik Koordinat Presisi (Kanonik)' },
  { value: 'alamat/ruas', label: 'Alamat / Ruas Jalan' },
  { value: 'desa/kelurahan', label: 'Tingkat Kelurahan / Desa' },
  { value: 'kecamatan', label: 'Tingkat Kecamatan' },
  { value: 'kabupaten/kota', label: 'Tingkat Kabupaten / Kota' },
];

export default function ProjectEditModal() {
  const {
    projects,
    editingProjectId,
    setEditingProjectId,
    isCreateProjectOpen,
    setIsCreateProjectOpen,
    updateProject,
    addProject,
    deleteProject,
  } = useWarta();

  const isCreate = isCreateProjectOpen;
  const project =
    projects.find((p) => p.id === editingProjectId) ||
    WARTA_PROJECTS.find((p) => p.id === editingProjectId);

  const [title, setTitle] = useState('');
  const [satker, setSatker] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [status, setStatus] = useState<ReportStatus>('menunggu');
  const [paguCompact, setPaguCompact] = useState('');
  const [kontrakCompact, setKontrakCompact] = useState('');
  const [locationDesc, setLocationDesc] = useState('');
  const [precisionLevel, setPrecisionLevel] = useState<PrecisionLevel>('titik');
  const [pin, setPin] = useState<MiniPinValue>({
    x: 50,
    y: 50,
    lat: -6.1754,
    lng: 106.8272,
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Inisialisasi form dari data proyek yang diedit
  useEffect(() => {
    if (project && !isCreate) {
      setTitle(project.title);
      setSatker(project.satker);
      setCategory(project.category);
      setStatus(project.status);
      setPaguCompact(project.paguCompact);
      setKontrakCompact(project.kontrakCompact ?? '');
      setLocationDesc(project.locationDesc);
      setPrecisionLevel(project.precisionLevel);
      setPin({
        x: project.mapCoordinates?.svgX ?? 50,
        y: project.mapCoordinates?.svgY ?? 50,
        lat: project.mapCoordinates?.lat ?? -6.1754,
        lng: project.mapCoordinates?.lng ?? 106.8272,
        address: project.locationDesc,
      });
      setSavedSuccess(false);
    } else if (isCreate) {
      setTitle('');
      setSatker('Dinas Bina Marga Provinsi DKI Jakarta');
      setCategory(CATEGORIES[0]);
      setStatus('menunggu');
      setPaguCompact('Rp15,00 miliar');
      setKontrakCompact('');
      setLocationDesc('Gambir, Kota Jakarta Pusat');
      setPrecisionLevel('titik');
      setPin({
        x: 50,
        y: 50,
        lat: -6.1754,
        lng: 106.8272,
        address: 'Jl. Medan Merdeka Barat, Gambir, Jakarta Pusat',
      });
      setSavedSuccess(false);
    }
  }, [project, isCreate]);

  // Tutup dengan keyboard ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingProjectId(null);
        setIsCreateProjectOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setEditingProjectId, setIsCreateProjectOpen]);

  if (!isCreate && !project) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const lat = pin.lat ?? -6.1754;
    const lng = pin.lng ?? 106.8272;

    if (isCreate) {
      const newId = `proj-${Date.now()}`;
      const newProject: ProjectPackage = {
        id: newId,
        title: title.trim(),
        spseCode: String(Math.floor(10000000000 + Math.random() * 9000000000)),
        failedTenders: [],
        satker: satker.trim(),
        category,
        paguRaw: 15000000000,
        paguCompact: paguCompact || 'Rp15,00 miliar',
        paguFull: paguCompact || 'Rp15.000.000.000',
        hpsCompact: paguCompact || 'Rp14,50 miliar',
        hpsFull: paguCompact || 'Rp14.500.000.000',
        kontrakCompact: kontrakCompact.trim() ? kontrakCompact.trim() : null,
        kontrakFull: kontrakCompact.trim() ? kontrakCompact.trim() : null,
        kontrakAvailable: Boolean(kontrakCompact.trim()),
        years: ['2026'],
        fundingSource: 'APBD DKI Jakarta 2026',
        city: 'Kota Jakarta Pusat',
        isOutsideDki: false,
        locationDesc: locationDesc.trim() || 'Jakarta Pusat',
        precisionLevel,
        precisionBadge: precisionLevel === 'titik' ? 'Titik Koordinat Presisi' : 'Area Wilayah',
        isRoughArea: precisionLevel !== 'titik',
        isCanonicalClaimed: true,
        locationSource: 'SPSE',
        isRetender: false,
        riskFlags: [],
        distanceText: 'Pusat Kota Jakarta',
        reportsCount: 0,
        verificationsCount: 0,
        status,
        sourceNote: 'Sumber: Input Admin Dinas Teknis',
        mapCoordinates: { svgX: pin.x, svgY: pin.y, lat, lng },
      };
      addProject(newProject);
    } else if (project) {
      updateProject(project.id, {
        title: title.trim(),
        satker: satker.trim(),
        category,
        status,
        paguCompact: paguCompact.trim(),
        kontrakCompact: kontrakCompact.trim() ? kontrakCompact.trim() : null,
        kontrakAvailable: Boolean(kontrakCompact.trim()),
        locationDesc: locationDesc.trim(),
        precisionLevel,
        precisionBadge: precisionLevel === 'titik' ? 'Titik Koordinat Presisi' : project.precisionBadge,
        isRoughArea: precisionLevel !== 'titik',
        mapCoordinates: {
          svgX: pin.x,
          svgY: pin.y,
          lat,
          lng,
        },
      });
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setEditingProjectId(null);
      setIsCreateProjectOpen(false);
    }, 600);
  };

  const handleDelete = () => {
    if (!project) return;
    if (window.confirm(`Yakin ingin menghapus paket proyek "${project.title}"?`)) {
      deleteProject(project.id);
      setEditingProjectId(null);
    }
  };

  const handleClose = () => {
    setEditingProjectId(null);
    setIsCreateProjectOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative my-8 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
        {/* Header Modal */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-brand/10 text-brand">
              <Building2 className="size-6" />
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
                {isCreate ? 'Tambah Paket Proyek APBD Baru' : 'Kelola & Edit Data Proyek'}
              </h2>
              <p className="text-xs text-slate-500">
                {isCreate
                  ? 'Masukkan informasi pengadaan, lokasi peta, dan pagu anggaran resmi'
                  : `Kode SPSE: ${project?.spseCode ?? '-'} · ID: ${project?.id}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {/* 1. Judul Proyek */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Nama Paket Pekerjaan / Proyek *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Revitalisasi Trotoar dan Saluran Drainase Jl. Siliwangi"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
            />
          </div>

          {/* 2. Satker & Kategori */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Satuan Kerja / Dinas Penanggung Jawab
              </label>
              <input
                type="text"
                required
                value={satker}
                onChange={(e) => setSatker(e.target.value)}
                placeholder="Dinas Pekerjaan Umum dan Penataan Ruang"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Kategori Pekerjaan
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Status Pengerjaan & Nilai Anggaran */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Status Pelaksanaan
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReportStatus)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Pagu Anggaran (Format Ringkas)
              </label>
              <input
                type="text"
                required
                value={paguCompact}
                onChange={(e) => setPaguCompact(e.target.value)}
                placeholder="Contoh: Rp3,45 miliar"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-brand outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Nilai Kontrak Pemenang
              </label>
              <input
                type="text"
                value={kontrakCompact}
                onChange={(e) => setKontrakCompact(e.target.value)}
                placeholder="Kosongkan jika belum lelang"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition"
              />
            </div>
          </div>

          {/* 4. Lokasi & Peta OpenStreetMap Interaktif */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-brand" />
                <h3 className="text-sm font-bold text-slate-900">
                  Titik Lokasi Kanonik Proyek (Peta OSM)
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Klik peta atau geser pin untuk menentukan koordinat fisik
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Deskripsi / Patokan Alamat Proyek
                </label>
                <input
                  type="text"
                  value={locationDesc}
                  onChange={(e) => setLocationDesc(e.target.value)}
                  placeholder="Contoh: Jl. Siliwangi No. 12, Pamoyanan, Cianjur"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tingkat Presisi Lokasi
                </label>
                <select
                  value={precisionLevel}
                  onChange={(e) => setPrecisionLevel(e.target.value as PrecisionLevel)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  {PRECISION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Peta Pin Picker Leaflet OpenStreetMap */}
            <MiniPinMap
              value={pin}
              onChange={(next) => {
                setPin(next);
                if (next.address && (!locationDesc || locationDesc === project?.locationDesc)) {
                  setLocationDesc(next.address);
                }
              }}
              centerLat={pin.lat}
              centerLng={pin.lng}
              heightClass="h-56"
              label="Klik jalan atau lokasi bangunan untuk mengunci titik koordinat proyek"
            />
          </div>

          {/* Footer Action */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <div>
              {!isCreate && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  Hapus Paket
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savedSuccess}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-xs hover:bg-brand-dark transition cursor-pointer disabled:bg-emerald-600"
              >
                {savedSuccess ? (
                  <>
                    <Check className="size-4" /> Tersimpan!
                  </>
                ) : (
                  <>
                    <Save className="size-4" /> Simpan Perubahan
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
