import { api } from './api';
import type { components } from '../types/api';
import type { PrecisionLevel, ProjectPackage, ReportStatus } from '../types/warta';

export type ProjectSummary = components['schemas']['ProjectSummary'];
export type ProjectDetail = components['schemas']['ProjectDetail'];
export type ProjectMapPin = components['schemas']['ProjectMapPin'];
export type Meta = components['schemas']['Meta'];

export interface ProjectQueryParams {
  q?: string;
  category?: string;
  city?: string;
  status?: string;
  year?: number | string;
  precision_level?: string;
  is_outside_dki?: boolean;
  is_retender?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

export interface MapQueryParams {
  bbox: string;
  status?: string;
  category?: string;
}

export interface ProjectsListResponse {
  data: ProjectSummary[];
  meta: Meta;
}

export function projectCoordinatesToSvg(
  lat: number | null | undefined,
  lng: number | null | undefined,
  city?: string,
  isOutsideDki?: boolean,
): { svgX: number; svgY: number; lat: number; lng: number } {
  const defaultLat = -6.1754; // Monas (Jakarta Pusat)
  const defaultLng = 106.8272;

  if (city === 'Kepulauan Seribu' || (lat != null && lat > -6.0)) {
    return { svgX: 150, svgY: 145, lat: lat ?? -5.7459, lng: lng ?? 106.6138 };
  }
  if (isOutsideDki || city === 'Bekasi') {
    return { svgX: 900, svgY: 670, lat: lat ?? -6.2383, lng: lng ?? 106.9756 };
  }

  const finalLat = lat ?? defaultLat;
  const finalLng = lng ?? defaultLng;

  // Bounds DKI Jakarta mainland:
  // Lng 106.68..106.98 -> SVG X 100..900
  // Lat -6.08..-6.37 -> SVG Y 220..780
  const minLng = 106.68;
  const maxLng = 106.98;
  const minLat = -6.37;
  const maxLat = -6.08;

  const clampedLng = Math.max(minLng, Math.min(maxLng, finalLng));
  const clampedLat = Math.max(minLat, Math.min(maxLat, finalLat));

  const svgX = Math.round(100 + ((clampedLng - minLng) / (maxLng - minLng)) * (900 - 100));
  const svgY = Math.round(220 + ((maxLat - clampedLat) / (maxLat - minLat)) * (780 - 220));

  return { svgX, svgY, lat: finalLat, lng: finalLng };
}

export function toProjectPackage(
  p: ProjectSummary,
  coords?: { lat?: number | null; lng?: number | null },
): ProjectPackage {
  const isRough = p.precision_level === 'kabupaten/kota' || p.precision_level === 'kecamatan';
  const mapCoords = projectCoordinatesToSvg(
    coords?.lat,
    coords?.lng,
    p.city,
    p.is_outside_dki,
  );

  return {
    id: p.id,
    title: p.title,
    spseCode: p.spse_code,
    failedTenders: [],
    satker: p.satker,
    category: p.category,
    paguRaw: parseFloat(p.pagu_amount) || 0,
    paguCompact: p.derived?.pagu_compact ?? '',
    paguFull: p.derived?.pagu_full ?? '',
    hpsCompact: p.derived?.hps_compact ?? '',
    hpsFull: p.derived?.hps_full ?? '',
    kontrakCompact: p.derived?.kontrak_compact ?? null,
    kontrakFull: p.derived?.kontrak_full ?? null,
    kontrakAvailable: p.contract_available,
    contractMicrocopy: p.contract_available ? undefined : 'Nilai kontrak belum tersedia di sumber publik.',
    years: (p.years ?? []).map(String),
    fundingSource: 'APBD DKI Jakarta',
    city: p.city,
    isOutsideDki: p.is_outside_dki,
    locationDesc: p.city,
    precisionLevel: p.precision_level as PrecisionLevel,
    precisionBadge: p.derived?.precision_badge ?? '',
    isRoughArea: isRough,
    isCanonicalClaimed: p.is_canonical_claimed,
    locationSource: p.location_source === 'warga' ? 'warga' : 'SPSE',
    isRetender: p.is_retender,
    subLocations: [],
    riskFlags: [],
    distanceText: p.city,
    reportsCount: p.reports_count,
    verificationsCount: p.verifications_count,
    status: p.status as ReportStatus,
    sourceNote: 'Data bersumber dari LPSE / SPSE DKI Jakarta',
    mapCoordinates: mapCoords,
  };
}

export function detailToProjectPackage(d: ProjectDetail): ProjectPackage {
  const base = toProjectPackage(d, {
    lat: d.location?.latitude,
    lng: d.location?.longitude,
  });

  return {
    ...base,
    locationDesc: d.location?.address || base.city,
    precisionResolutionNote: d.precision_resolution_note ?? undefined,
    sourceNote: d.source_note ?? base.sourceNote,
    contractMicrocopy: d.contract_note ?? base.contractMicrocopy,
    failedTenders: (d.tenders ?? [])
      .filter((t) => t.status === 'dibatalkan')
      .map((t) => ({
        code: t.spse_code,
        status: 'Tender Gagal' as const,
        note: t.note ?? undefined,
      })),
    subLocations: (d.sub_locations ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      city: s.city,
      verified: s.verified,
    })),
    riskFlags: (d.risk_flags ?? []).map((f) => ({
      id: f.code,
      label: f.label,
      level: f.level === 'warning' ? 'warning' : 'info',
      description: f.description,
    })),
  };
}

export const projectsService = {
  async listProjects(params?: ProjectQueryParams, signal?: AbortSignal): Promise<ProjectsListResponse> {
    const res = await api.get<ProjectsListResponse>('/projects', {
      params,
      signal,
    });
    return res.data;
  },

  async getProjectMapPins(params: MapQueryParams, signal?: AbortSignal): Promise<ProjectMapPin[]> {
    const res = await api.get<{ data: ProjectMapPin[] }>('/projects/map', {
      params,
      signal,
    });
    return res.data.data;
  },

  async getProjectById(id: string, signal?: AbortSignal): Promise<ProjectDetail> {
    const res = await api.get<{ data: ProjectDetail }>(`/projects/${id}`, {
      signal,
    });
    return res.data.data;
  },
};
