import { api } from './api';
import type { components } from '../types/api';
import type { CitizenReport, ProjectPackage, ReportCategory, ReportStatus } from '../types/warta';

export type UserPrivate = components['schemas']['UserPrivate'];
export type UpdateProfileRequest = components['schemas']['UpdateProfileRequest'];
export type Report = components['schemas']['Report'];
export type Meta = components['schemas']['Meta'];

export interface GetMyReportsParams {
  status?: string;
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  data: T;
}

/**
 * Mengubah objek Report dari API menjadi CitizenReport yang sesuai dengan antarmuka akun warga.
 */
export function reportToCitizenReport(
  r: Report,
  proj?: ProjectPackage | null,
): CitizenReport {
  const photoUrls =
    r.media && r.media.length > 0 ? r.media.map((m) => m.file_url) : undefined;

  return {
    id: r.id,
    projectId: r.project_id,
    projectTitle: proj?.title ?? 'Paket Proyek SPSE',
    spseCode: proj?.spseCode ?? '',
    category: (r.category as ReportCategory) || 'kesesuaian_spesifikasi',
    narrative: r.narrative,
    proposedAddress: r.proposed_address ?? undefined,
    photoUrls,
    exifValid: r.exif_status === 'valid',
    distanceFromProject:
      r.distance_from_project_m != null
        ? `${Math.round(r.distance_from_project_m)} m dari proyek`
        : undefined,
    createdAt: r.created_at
      ? new Date(r.created_at).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '',
    status: (r.status as ReportStatus) || 'menunggu',
  };
}

export const userService = {
  /**
   * Mengubah nama tampilan warga (PATCH /users/me).
   * Validasi backend: 3-24 karakter alphanumeric + garis bawah.
   */
  async updateMe(payload: UpdateProfileRequest): Promise<UserPrivate> {
    const res = await api.patch<ApiResponse<UserPrivate>>('/users/me', payload);
    return res.data.data;
  },

  /**
   * Mengambil riwayat pengaduan yang diajukan oleh pengguna yang sedang login (GET /users/me/reports).
   */
  async getMyReports(
    params?: GetMyReportsParams,
    signal?: AbortSignal,
  ): Promise<{ data: Report[]; meta: Meta }> {
    const res = await api.get<{ data: Report[]; meta: Meta }>('/users/me/reports', {
      params,
      signal,
    });
    return res.data;
  },
};
