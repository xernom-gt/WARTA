export interface CreateProjectPayload {
  title: string;
  spse_code?: string;
  satker: string;
  category: string;
  pagu_amount: string;
  hps_amount?: string;
  contract_amount?: string | null;
  contract_note?: string | null;
  city: string;
  is_outside_dki?: boolean;
  precision_level?: string;
  status?: ReportStatus;
  source_note?: string | null;
  years?: number[];
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateProjectPayload {
  title?: string;
  satker?: string;
  category?: string;
  pagu_amount?: string;
  hps_amount?: string;
  contract_amount?: string | null;
  contract_note?: string | null;
  city?: string;
  is_outside_dki?: boolean;
  precision_level?: string;
  status?: ReportStatus;
  source_note?: string | null;
  years?: number[];
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
}
import { api } from './api';
import type { PrecisionLevel, ReportStatus } from '../types/warta';

export interface ProjectSummaryDTO {
  id: string;
  title: string;
  spse_code: string;
  satker: string;
  category: string;
  city: string;
  pagu_amount: string;
  hps_amount: string;
  contract_amount?: string | null;
  contract_available: boolean;
  years: number[];
  precision_level: PrecisionLevel;
  location_source: 'SPSE' | 'warga';
  is_canonical_claimed: boolean;
  is_outside_dki: boolean;
  is_retender: boolean;
  reports_count: number;
  verifications_count: number;
  status: ReportStatus;
  derived: {
    funding_source: string;
    distance_text: string;
    precision_badge: string;
    is_rough_area: boolean;
    contract_microcopy?: string;
    precision_microcopy?: string;
    canonical_microcopy?: string;
    retender_microcopy?: string;
    multi_years_microcopy?: string;
    sub_locations_microcopy?: string;
  };
}

export interface TenderDTO {
  id: string;
  spse_code: string;
  status: string;
  note?: string | null;
  created_at: string;
}

export interface LocationDTO {
  id: string;
  name?: string | null;
  address: string;
  city: string;
  precision_level: string;
  source: string;
  latitude?: number | null;
  longitude?: number | null;
  is_verified: boolean;
  is_primary: boolean;
}

export interface ProjectLocationsDTO {
  primary_location_id?: string | null;
  locations: LocationDTO[];
}

export interface RiskFlagDTO {
  code: string;
  label: string;
  level: 'warning' | 'info';
  description: string;
}

export interface ProjectDetailDTO extends ProjectSummaryDTO {
  contract_note?: string | null;
  precision_note?: string | null;
  source_note: string;
  location?: {
    address: string;
    city: string;
    precision_level: string;
    source: string;
    is_canonical_claimed: boolean;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
  tenders: TenderDTO[];
  sub_locations: Array<{
    id: string;
    name?: string | null;
    address: string;
    city: string;
    verified: boolean;
  }>;
  risk_flags: RiskFlagDTO[];
}

export interface ProjectListFilter {
  q?: string;
  category?: string;
  city?: string;
  precision_level?: string;
  status?: string;
  year?: number | string;
  page?: number;
  limit?: number;
}

export interface ProjectListResponse {
  data: ProjectSummaryDTO[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export const projectService = {
  async listProjects(filter?: ProjectListFilter): Promise<ProjectListResponse> {
    const params = new URLSearchParams();
    if (filter?.q) params.append('q', filter.q);
    if (filter?.category) params.append('category', filter.category);
    if (filter?.city) params.append('city', filter.city);
    if (filter?.precision_level) params.append('precision_level', filter.precision_level);
    if (filter?.status) params.append('status', filter.status);
    if (filter?.year) params.append('year', String(filter.year));
    if (filter?.page) params.append('page', String(filter.page));
    if (filter?.limit) params.append('limit', String(filter.limit));

    const { data } = await api.get<ProjectListResponse>('/projects', { params });
    return data;
  },

  async getProject(id: string): Promise<ProjectDetailDTO> {
    const { data } = await api.get<{ data: ProjectDetailDTO }>(`/projects/${id}`);
    return data.data;
  },

  async getProjectTenders(id: string): Promise<TenderDTO[]> {
    const { data } = await api.get<{ data: TenderDTO[] }>(`/projects/${id}/tenders`);
    return data.data;
  },

  async getProjectLocations(id: string): Promise<ProjectLocationsDTO> {
    const { data } = await api.get<{ data: ProjectLocationsDTO }>(`/projects/${id}/locations`);
    return data.data;
  },

  async getProjectRiskFlags(id: string): Promise<RiskFlagDTO[]> {
    const { data } = await api.get<{ data: RiskFlagDTO[] }>(`/projects/${id}/risk-flags`);
    return data.data;
  },

  async createProject(payload: CreateProjectPayload): Promise<ProjectSummaryDTO> {
    const { data } = await api.post<{ data: ProjectSummaryDTO }>('/projects', payload);
    return data.data;
  },

  async updateProject(id: string, payload: UpdateProjectPayload): Promise<ProjectSummaryDTO> {
    const { data } = await api.patch<{ data: ProjectSummaryDTO }>(`/projects/${id}`, payload);
    return data.data;
  },
};

