import { api } from './api';
import type { components } from '../types/api';
import type {
  ClaimStatus,
  PrecisionLevel,
  ProjectPackage,
  ReportCategory,
  ReportStatus,
  VerificationItem,
} from '../types/warta';
import { REPORT_CATEGORY_LABELS } from '../data/wartaData';

export type Report = components['schemas']['Report'];
export type CreateReportRequest = components['schemas']['CreateReportRequest'];
export type UpdateReportRequest = components['schemas']['UpdateReportRequest'];
export type ReportMedia = components['schemas']['ReportMedia'];
export type ApiVerificationItem = components['schemas']['VerificationItem'];
export type Meta = components['schemas']['Meta'];

export interface ProjectReportsParams {
  status?: string;
  category?: string;
  author_user_id?: string;
  page?: number;
  limit?: number;
}

export interface VerificationQueueParams {
  status?: string;
  item_type?: string;
  project_id?: string;
  page?: number;
  limit?: number;
}

export function reportToVerificationItem(
  r: Report,
  proj?: ProjectPackage | null,
): VerificationItem {
  const photoUrl =
    r.media && r.media.length > 0 && r.media[0].file_url
      ? r.media[0].file_url
      : '/photos/rusun-rorotan.svg';
  const photoUrls =
    r.media && r.media.length > 0 ? r.media.map((m) => m.file_url) : [photoUrl];

  return {
    id: r.id,
    projectId: r.project_id,
    projectTitle: proj?.title ?? 'Paket Proyek SPSE',
    spseCode: proj?.spseCode ?? '',
    satker: proj?.satker ?? 'Dinas Terkait',
    paguCompact: proj?.paguCompact ?? 'Rp0',
    itemType: 'laporan_kondisi',
    category: r.category as ReportCategory | undefined,
    categoryLabel: r.category
      ? REPORT_CATEGORY_LABELS[r.category as ReportCategory] ?? r.category
      : 'Laporan Kondisi',
    authorDisplayName: r.author_display_name,
    createdAt: r.submitted_at
      ? new Date(r.submitted_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : new Date(r.created_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    distanceFromProject:
      r.distance_from_project_m != null
        ? `${Math.round(r.distance_from_project_m)} m dari proyek`
        : undefined,
    exifValid: r.exif_status === 'valid',
    exifNotice: r.exif_notice ?? undefined,
    narrative: r.narrative,
    proposedAddress: r.proposed_address ?? '',
    coordinates: {
      lat: r.latitude ?? -6.2,
      lng: r.longitude ?? 106.8,
    },
    photoUrl,
    photoUrls,
    votesAgree: 0,
    votesDisagree: 0,
    targetVotes: 3,
    voters: [],
    status: (r.status as ReportStatus) || 'menunggu',
    evidences: [],
  };
}

export function apiItemToVerificationItem(it: ApiVerificationItem): VerificationItem {
  const photoUrl = it.photo_url || '/photos/rusun-rorotan.svg';
  return {
    id: it.id,
    projectId: it.project_id,
    projectTitle: it.project_title,
    spseCode: it.spse_code,
    satker: it.satker,
    paguCompact: it.pagu_amount ? `Rp${it.pagu_amount}` : 'Rp0',
    itemType: it.item_type,
    categoryLabel:
      it.category_label || (it.item_type === 'klaim_lokasi' ? 'Klaim Lokasi' : 'Laporan Kondisi'),
    authorDisplayName: it.author_display_name,
    createdAt: new Date(it.created_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    distanceFromProject:
      it.distance_from_project_m != null
        ? `${Math.round(it.distance_from_project_m)} m dari proyek`
        : undefined,
    exifValid: it.exif_status === 'valid',
    exifNotice: it.exif_notice ?? undefined,
    narrative: it.narrative,
    proposedAddress: it.proposed_address ?? '',
    proposedPrecision: it.proposed_precision as PrecisionLevel | undefined,
    coordinates: {
      lat: it.latitude ?? -6.2,
      lng: it.longitude ?? 106.8,
    },
    photoUrl,
    photoUrls: [photoUrl],
    votesAgree: it.votes_agree,
    votesDisagree: it.votes_disagree,
    targetVotes: it.target_votes,
    voters: it.voters || [],
    status: (it.status as ReportStatus | ClaimStatus) || 'menunggu',
    evidences: [],
  };
}

export const reportsService = {
  /** Buat laporan baru (sebagai draft jika submit=false, atau submit langsung jika submit=true). */
  async createReport(projectId: string, payload: CreateReportRequest): Promise<Report> {
    const res = await api.post<{ data: Report }>(`/projects/${projectId}/reports`, payload);
    return res.data.data;
  },

  /** Perbarui draft laporan sebelum diserahkan. */
  async updateReport(reportId: string, payload: UpdateReportRequest): Promise<Report> {
    const res = await api.patch<{ data: Report }>(`/reports/${reportId}`, payload);
    return res.data.data;
  },

  /** Upload foto media bukti lapangan (maks 5MB, format JPEG/PNG/WebP, batas 4 foto). */
  async uploadReportMedia(reportId: string, file: File | Blob, sortOrder?: number): Promise<ReportMedia> {
    const form = new FormData();
    form.append('file', file);
    if (typeof sortOrder === 'number') {
      form.append('sort_order', String(sortOrder));
    }

    const res = await api.post<{ data: ReportMedia }>(`/reports/${reportId}/media`, form, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data.data;
  },

  /** Ajukan draft laporan ke antrean verifikasi warga (status draft -> menunggu). */
  async submitReport(reportId: string): Promise<Report> {
    const res = await api.post<{ data: Report }>(`/reports/${reportId}/submit`);
    return res.data.data;
  },

  /** Ambil detail satu laporan beserta foto medianya. */
  async getReport(reportId: string): Promise<Report> {
    const res = await api.get<{ data: Report }>(`/reports/${reportId}`);
    return res.data.data;
  },

  /** Hapus draft laporan (hanya jika masih berstatus draft). */
  async deleteReport(reportId: string): Promise<void> {
    await api.delete(`/reports/${reportId}`);
  },

  /** Ambil daftar laporan terkirim untuk satu proyek tertentu (GET /projects/:id/reports). */
  async listProjectReports(
    projectId: string,
    params?: ProjectReportsParams,
    signal?: AbortSignal,
  ): Promise<{ data: Report[]; meta: Meta }> {
    const res = await api.get<{ data: Report[]; meta: Meta }>(`/projects/${projectId}/reports`, {
      params,
      signal,
    });
    return res.data;
  },

  /** Ambil antrean verifikasi global (GET /verification-items). */
  async listVerificationQueue(
    params?: VerificationQueueParams,
    signal?: AbortSignal,
  ): Promise<{ data: ApiVerificationItem[]; meta: Meta }> {
    const res = await api.get<{ data: ApiVerificationItem[]; meta: Meta }>('/verification-items', {
      params,
      signal,
    });
    return res.data;
  },
};
