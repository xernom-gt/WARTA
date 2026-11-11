import type { CitizenClaim, CitizenReport, ReportCategory, VerificationItem } from '../types/warta';
import { REPORT_CATEGORY_LABELS } from '../data/wartaData';
import { EXIF_VALID_TEXT, EXIF_INVALID_TEXT } from '../components/common/ExifCheckBadge';

interface ReportInput {
  id?: string;
  projectId: string;
  projectTitle: string;
  spseCode: string;
  category: ReportCategory | '';
  narrative: string;
  proposedAddress: string;
  photoUrls: string[];
  exifValid?: boolean;
  status: CitizenReport['status'];
}

export const buildReport = (input: ReportInput): CitizenReport => ({
  id: input.id ?? `rep-${Date.now()}`,
  projectId: input.projectId,
  projectTitle: input.projectTitle,
  spseCode: input.spseCode,
  category: (input.category || 'belum_mulai') as ReportCategory,
  narrative: input.narrative.trim() || '(Draf tanpa deskripsi)',
  proposedAddress: input.proposedAddress.trim(),
  photoUrls: input.photoUrls,
  exifValid: input.exifValid,
  createdAt: 'Baru saja',
  status: input.status,
});

interface VerificationItemInput {
  projectId: string;
  projectTitle: string;
  spseCode: string;
  satker: string;
  paguCompact: string;
  itemType: 'laporan_kondisi' | 'klaim_lokasi';
  category?: ReportCategory;
  authorDisplayName: string;
  exifValid?: boolean;
  narrative: string;
  proposedAddress: string;
  photoUrl: string;
  photoUrls: string[];
  proposedPrecision?: string;
  coordinates: { lat: number; lng: number };
}

export const buildVerificationItem = (input: VerificationItemInput): VerificationItem => {
  const categoryLabel =
    input.itemType === 'laporan_kondisi' && input.category
      ? REPORT_CATEGORY_LABELS[input.category]
      : 'Klaim Lokasi Kanonik';

  return {
    id: `ver-${Date.now()}`,
    projectId: input.projectId,
    projectTitle: input.projectTitle,
    spseCode: input.spseCode,
    satker: input.satker,
    paguCompact: input.paguCompact,
    itemType: input.itemType,
    category: input.category,
    categoryLabel,
    authorDisplayName: input.authorDisplayName,
    createdAt: 'Baru saja',
    exifValid: input.exifValid,
    exifNotice:
      typeof input.exifValid === 'boolean'
        ? input.exifValid
          ? EXIF_VALID_TEXT
          : EXIF_INVALID_TEXT
        : undefined,
    narrative: input.narrative,
    proposedAddress: input.proposedAddress,
    proposedPrecision: input.proposedPrecision as any,
    coordinates: input.coordinates,
    photoUrl: input.photoUrl,
    photoUrls: input.photoUrls,
    votesAgree: 0,
    votesDisagree: 0,
    targetVotes: 3,
    voters: [],
    status: 'menunggu',
    evidences: [],
  };
};

interface ClaimInput {
  projectId: string;
  projectTitle: string;
  spseCode: string;
  proposedAddress: string;
  proposedPrecision: string;
  photoUrl: string;
}

export const buildClaim = (input: ClaimInput): CitizenClaim => ({
  id: `clm-${Date.now()}`,
  projectId: input.projectId,
  projectTitle: input.projectTitle,
  spseCode: input.spseCode,
  proposedAddress: input.proposedAddress,
  proposedPrecision: input.proposedPrecision as any,
  photoUrl: input.photoUrl,
  createdAt: 'Baru saja',
  status: 'menunggu',
});

export const buildClaimAddress = (
  address: string,
  kelurahan: string,
  kecamatan: string,
  landmark: string,
): string => {
  return [
    address.trim(),
    kelurahan.trim() && `Kel. ${kelurahan.trim()}`,
    `Kec. ${kecamatan.trim()}`,
    landmark.trim() && `(dekat ${landmark.trim()})`,
  ]
    .filter(Boolean)
    .join(', ');
};
