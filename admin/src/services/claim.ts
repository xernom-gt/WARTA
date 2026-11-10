import { api } from './api';
import type { PrecisionLevel } from '../types/warta';

export interface CreateClaimPayload {
  proposed_address: string;
  address_line?: string;
  kelurahan?: string;
  kecamatan: string;
  city?: string;
  landmark?: string;
  proposed_precision: PrecisionLevel;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ClaimDTO {
  id: string;
  project_id: string;
  user_id: string;
  author_display_name: string;
  proposed_address: string;
  address_line?: string | null;
  kelurahan?: string | null;
  kecamatan: string;
  city?: string | null;
  landmark?: string | null;
  proposed_precision: string;
  latitude?: number | null;
  longitude?: number | null;
  distance_from_project_m?: number | null;
  exif_status: string;
  exif_notice?: string | null;
  status: 'menunggu' | 'diterima' | 'ditolak';
  created_at: string;
  updated_at: string;
  decided_at?: string | null;
}

export interface ClaimMediaDTO {
  id: string;
  claim_id: string;
  file_url: string;
  media_type: string;
  exif_latitude?: number | null;
  exif_longitude?: number | null;
  exif_taken_at?: string | null;
  is_geotag_valid?: boolean | null;
  created_at: string;
}

export const claimService = {
  async createClaim(projectId: string, payload: CreateClaimPayload): Promise<ClaimDTO> {
    const { data } = await api.post<{ data: ClaimDTO }>(`/projects/${projectId}/location-claims`, payload);
    return data.data;
  },

  async uploadClaimMedia(claimId: string, file: File): Promise<ClaimMediaDTO> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post<{ data: ClaimMediaDTO }>(`/location-claims/${claimId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  async getClaim(claimId: string): Promise<ClaimDTO> {
    const { data } = await api.get<{ data: ClaimDTO }>(`/location-claims/${claimId}`);
    return data.data;
  },

  async getClaimMedia(claimId: string): Promise<ClaimMediaDTO> {
    const { data } = await api.get<{ data: ClaimMediaDTO }>(`/location-claims/${claimId}/media`);
    return data.data;
  },
};

