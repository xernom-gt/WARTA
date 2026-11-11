import { MIN_NARRATIVE } from '../constants/formConfig';

export const validateReportForm = (
  category: string | null,
  proposedAddress: string,
  narrative: string,
  photosCount: number,
) => {
  const errs: string[] = [];
  if (!category) errs.push('Pilih salah satu kategori kondisi lapangan.');
  if (!proposedAddress.trim()) errs.push('Isi alamat atau titik lokasi pengamatan.');
  if (narrative.trim().length < MIN_NARRATIVE)
    errs.push(`Deskripsi pengamatan minimal ${MIN_NARRATIVE} karakter.`);
  if (photosCount === 0) errs.push('Unggah minimal 1 foto bukti lapangan (maksimal 4 foto).');
  return errs;
};

export const validateClaimForm = (
  level: string,
  claimAddress: string,
  kecamatan: string,
  claimPhoto: string | null,
) => {
  const errs: string[] = [];
  if (!claimAddress.trim() && level !== 'kecamatan' && level !== 'desa/kelurahan') {
    errs.push('Isi alamat spesifik atau nama ruas jalan.');
  }
  if (!kecamatan.trim()) errs.push('Isi nama kecamatan.');
  if (!claimPhoto) errs.push('Unggah 1 foto papan informasi proyek.');
  return errs;
};
