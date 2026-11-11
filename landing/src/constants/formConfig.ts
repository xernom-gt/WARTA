import type { PrecisionLevel } from '../types/warta';

export const MAX_NARRATIVE = 500;
export const MIN_NARRATIVE = 20;
export const MAX_PHOTOS = 4;
export const MAX_PHOTO_SIZE_MB = 5;

export const PRECISION_LEVELS: { v: PrecisionLevel; l: string }[] = [
  { v: 'titik', l: 'Titik Koordinat Pasti' },
  { v: 'alamat/ruas', l: 'Ruas Jalan / Alamat' },
  { v: 'desa/kelurahan', l: 'Kelurahan / Desa' },
  { v: 'kecamatan', l: 'Kecamatan' },
];

export const SAMPLE_PHOTOS = [
  '/photos/rusun-rorotan.svg',
  '/photos/sekolah-tebet.svg',
  '/photos/tpst-bantargebang.svg',
];

export const INPUT_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export const SELECT_CLASS =
  'rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20';
