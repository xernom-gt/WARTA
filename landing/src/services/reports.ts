import { api } from './api';
import type { components } from '../types/api';

export type Report = components['schemas']['Report'];
export type CreateReportRequest = components['schemas']['CreateReportRequest'];
export type UpdateReportRequest = components['schemas']['UpdateReportRequest'];
export type ReportMedia = components['schemas']['ReportMedia'];

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
};
