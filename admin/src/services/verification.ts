import { api } from './api';
import type { VoteChoice } from '../types/warta';

export interface VerificationItemDTO {
  id: string;
  project_id: string;
  project_title: string;
  spse_code: string;
  satker: string;
  pagu_amount: string;
  item_type: 'laporan_kondisi' | 'klaim_lokasi';
  report_id?: string | null;
  claim_id?: string | null;
  author_display_name: string;
  category_label?: string | null;
  narrative?: string | null;
  proposed_address?: string | null;
  proposed_precision?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distance_from_project_m?: number | null;
  exif_status: string;
  exif_notice?: string | null;
  photo_url?: string | null;
  votes_agree: number;
  votes_disagree: number;
  target_votes: number;
  voters: string[];
  status: 'menunggu' | 'terverifikasi' | 'ditolak' | 'diterima';
  created_at: string;
  resolved_at?: string | null;
}

export interface VerificationFilter {
  status?: string;
  item_type?: string;
  project_id?: string;
  page?: number;
  limit?: number;
}

export interface ItemVoteDTO {
  id: string;
  verification_item_id: string;
  user_id: string;
  choice: VoteChoice;
  created_at: string;
}

export interface VerificationListResponse {
  data: VerificationItemDTO[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface VoteListResponse {
  data: ItemVoteDTO[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface CastVoteResponse {
  id: string;
  verification_item_id: string;
  project_id: string;
  project_title: string;
  item_type: string;
  author_display_name: string;
  choice: VoteChoice;
  created_at: string;
  resolution: {
    status: string;
    votes_agree: number;
    votes_disagree: number;
    target_votes: number;
    resolved_at?: string | null;
  };
}

export const verificationService = {
  async getQueue(filter?: VerificationFilter): Promise<VerificationListResponse> {
    const params = new URLSearchParams();
    if (filter?.status && filter.status !== 'semua') params.append('status', filter.status);
    if (filter?.item_type && filter.item_type !== 'semua') params.append('item_type', filter.item_type);
    if (filter?.project_id) params.append('project_id', filter.project_id);
    if (filter?.page) params.append('page', String(filter.page));
    if (filter?.limit) params.append('limit', String(filter.limit));

    const { data } = await api.get<VerificationListResponse>('/verification-items', {
      params,
    });
    return data;
  },

  async getItem(id: string): Promise<VerificationItemDTO> {
    const { data } = await api.get<{ data: VerificationItemDTO }>(`/verification-items/${id}`);
    return data.data;
  },

  async getVotes(itemId: string, page = 1, limit = 20): Promise<VoteListResponse> {
    const { data } = await api.get<VoteListResponse>(`/verification-items/${itemId}/votes`, {
      params: { page, limit },
    });
    return data;
  },

  async castVote(itemId: string, choice: VoteChoice): Promise<CastVoteResponse> {
    const { data } = await api.post<{ data: CastVoteResponse }>(`/verification-items/${itemId}/votes`, {
      choice,
    });
    return data.data;
  },
};

