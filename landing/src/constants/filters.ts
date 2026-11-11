import type { PrecisionLevel, ReportStatus } from '../types/warta';

export const CITIES = [
  'Semua',
  'Jakarta Utara',
  'Jakarta Selatan',
  'Jakarta Pusat & Jakarta Barat',
  'Bekasi',
  'Kepulauan Seribu',
] as const;

export const CATEGORIES = [
  'Semua',
  'Gedung & Permukiman',
  'Drainase & Pengendali Banjir',
  'Gedung Layanan Sosial',
  'Instalasi Pengolahan Air Sampah',
  'Tanggul Pesisir Pantai',
  'Gedung Sekolah',
  'Jaringan Perpipaan Air Limbah',
  'Ornamen & Fasilitas Wilayah',
] as const;

export const STATUSES: { value: 'Semua' | ReportStatus; label: string }[] = [
  { value: 'Semua', label: 'Semua status' },
  { value: 'menunggu', label: 'Menunggu verifikasi' },
  { value: 'terverifikasi', label: 'Terverifikasi warga' },
  { value: 'ditolak', label: 'Ditolak' },
  { value: 'selesai', label: 'Selesai' },
];

export const YEARS = ['Semua', '2022', '2023', '2024', '2025', '2026', '2027'] as const;

export const PRECISIONS: { value: 'Semua' | PrecisionLevel; label: string }[] = [
  { value: 'Semua', label: 'Semua tingkat lokasi' },
  { value: 'kabupaten/kota', label: 'Tingkat Kabupaten/Kota' },
  { value: 'kecamatan', label: 'Tingkat Kecamatan' },
  { value: 'desa/kelurahan', label: 'Tingkat Desa/Kelurahan' },
  { value: 'alamat/ruas', label: 'Alamat / Ruas Jalan' },
  { value: 'titik', label: 'Titik Koordinat Pasti' },
];
