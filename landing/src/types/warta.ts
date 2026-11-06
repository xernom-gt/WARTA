export type PrecisionLevel =
  | 'kabupaten/kota'
  | 'kecamatan'
  | 'desa/kelurahan'
  | 'alamat/ruas'
  | 'titik';

export type ReportStatus =
  | 'draft'
  | 'menunggu'
  | 'terverifikasi'
  | 'ditolak'
  | 'selesai';

export type ClaimStatus =
  | 'menunggu'
  | 'diterima'
  | 'ditolak';

export type UserRole = 'other' | 'owner' | 'guest';

export type MapCondition =
  | 'normal'
  | 'gps-denied'
  | 'filter-empty'
  | 'tile-error'
  | 'loading';

export type ActiveScreen =
  | 'peta'
  | 'aduan'
  | 'detail'
  | 'lapor'
  | 'verifikasi'
  | 'klaim'
  | 'profil';

export type ReportCategory =
  | 'belum_mulai'
  | 'lambat_mangkrak'
  | 'fisik_rusak'
  | 'papan_tidak_ada'
  | 'selesai';

export interface FailedTender {
  code: string;
  status: 'Tender Gagal';
  note?: string;
}

export interface SubLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  verified: boolean;
}

export interface RiskFlag {
  id: string;
  label: string;
  level: 'warning' | 'info';
  description: string;
}

export interface ProjectPackage {
  id: string;
  title: string;
  spseCode: string;
  failedTenders: FailedTender[];
  satker: string;
  category: string;
  paguRaw: number;
  paguCompact: string;
  paguFull: string;
  hpsCompact: string;
  hpsFull: string;
  kontrakCompact: string | null;
  kontrakFull: string | null;
  kontrakAvailable: boolean;
  contractMicrocopy?: string;
  years: string[];
  fundingSource: string;
  multiYearsMicrocopy?: string;
  city: string;
  isOutsideDki: boolean;
  locationDesc: string;
  precisionLevel: PrecisionLevel;
  precisionBadge: string;
  isRoughArea: boolean;
  precisionMicrocopy?: string;
  precisionResolutionNote?: string;
  isCanonicalClaimed: boolean;
  canonicalMicrocopy?: string;
  locationSource: 'SPSE' | 'warga';
  isRetender: boolean;
  retenderMicrocopy?: string;
  subLocations?: SubLocation[];
  subLocationsMicrocopy?: string;
  riskFlags: RiskFlag[];
  distanceText: string;
  reportsCount: number;
  verificationsCount: number;
  status: ReportStatus;
  sourceNote: string;
  mapCoordinates: { svgX: number; svgY: number; lat: number; lng: number };
}

export interface EvidenceItem {
  id: string;
  reportId: string;
  authorDisplayName: string;
  description: string;
  photoUrl?: string;
  createdAt: string;
}

export interface VerificationItem {
  id: string;
  projectId: string;
  projectTitle: string;
  spseCode: string;
  satker: string;
  paguCompact: string;
  itemType: 'laporan_kondisi' | 'klaim_lokasi';
  category?: ReportCategory;
  categoryLabel: string;
  authorDisplayName: string;
  createdAt: string;
  distanceFromProject: string;
  exifValid: boolean;
  exifNotice: string;
  narrative: string;
  proposedAddress: string;
  proposedPrecision?: PrecisionLevel;
  coordinates: { lat: number; lng: number };
  photoUrl: string;
  photoUrls?: string[];
  votesAgree: number;
  votesDisagree: number;
  targetVotes: number;
  voters: string[];
  status: ReportStatus | ClaimStatus;
  evidences?: EvidenceItem[];
}

export interface CitizenReport {
  id: string;
  projectId: string;
  projectTitle: string;
  spseCode: string;
  category: ReportCategory;
  narrative: string;
  proposedAddress?: string;
  photoUrls?: string[];
  exifValid?: boolean;
  distanceFromProject?: string;
  createdAt: string;
  status: ReportStatus;
}

export interface CitizenClaim {
  id: string;
  projectId: string;
  projectTitle: string;
  spseCode: string;
  proposedAddress: string;
  proposedPrecision: PrecisionLevel;
  photoUrl?: string;
  createdAt: string;
  status: ClaimStatus;
}

export type VoteChoice = 'setuju' | 'tidak_setuju';

export interface VoteRecord {
  itemId: string;
  projectId?: string;
  projectTitle: string;
  itemType: VerificationItem['itemType'];
  authorDisplayName: string;
  choice: VoteChoice;
  votedAt: string;
  resolution?: ReportStatus | ClaimStatus;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}
