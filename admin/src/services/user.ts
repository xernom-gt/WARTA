import { api } from './api';

// DTO shapes matching API response from api/internal/verification/vote.go and api/internal/claim/claim.go

export interface VoteResolutionDTO {
  status: string; // "menunggu" | "terverifikasi" | "diterima" | "ditolak"
  votes_agree: number;
  votes_disagree: number;
  target_votes: number;
  resolved_at?: string | null;
}

export interface MyVoteDTO {
  id: string;
  verification_item_id: string;
  project_id: string;
  project_title: string;
  item_type: 'laporan_kondisi' | 'klaim_lokasi';
  author_display_name: string;
  choice: 'setuju' | 'tidak_setuju';
  created_at: string;
  resolution: VoteResolutionDTO;
}

export interface MyClaimDTO {
  id: string;
  project_id: string;
  user_id: string;
  author_display_name: string;
  proposed_address: string;
  address_line?: string | null;
  kelurahan?: string | null;
  kecamatan: string;
  landmark?: string | null;
  proposed_precision: string;
  latitude?: number | null;
  longitude?: number | null;
  exif_status: string;
  exif_notice?: string | null;
  status: 'menunggu' | 'diterima' | 'ditolak';
  created_at: string;
  updated_at: string;
  decided_at?: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PagedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export const userService = {
  async getMyVotes(page = 1, limit = 20): Promise<PagedResponse<MyVoteDTO>> {
    const { data } = await api.get<{ data: MyVoteDTO[]; meta: PaginationMeta }>('/users/me/votes', {
      params: { page, limit },
    });
    return { data: data.data ?? [], meta: data.meta };
  },

  async getMyClaims(page = 1, limit = 20): Promise<PagedResponse<MyClaimDTO>> {
    const { data } = await api.get<{ data: MyClaimDTO[]; meta: PaginationMeta }>('/users/me/claims', {
      params: { page, limit },
    });
    return { data: data.data ?? [], meta: data.meta };
  },
};
