import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ProjectPackage } from '../../types/warta';

interface Props {
  projects: ProjectPackage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
}

/**
 * Peta Eksplorasi Proyek Berbasis OpenStreetMap (OSM) via Leaflet.
 * Menampilkan pin setiap paket tender SPSE secara interaktif.
 */
export default function OpenStreetMapExplorer({
  projects,
  selectedId,
  onSelect,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Inisialisasi Peta Leaflet & Tile OSM
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Default center ke Jakarta / Jawa Barat
    const map = L.map(containerRef.current, {
      center: [-6.18, 106.85],
      zoom: 11,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>')
      .addTo(map);

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers ketika daftar proyek atau selectedId berubah
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Bersihkan marker lama
    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const bounds = L.latLngBounds([]);

    projects.forEach((p) => {
      const lat = p.mapCoordinates?.lat;
      const lng = p.mapCoordinates?.lng;
      if (!lat || !lng) return;

      const isSelected = p.id === selectedId;

      // Custom HTML Marker Pin
      const icon = L.divIcon({
        className: 'warta-project-pin',
        html: `
          <div style="
            position: relative;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
          ">
            <div style="
              background-color: ${isSelected ? '#dc2626' : '#0369a1'};
              color: white;
              padding: 4px 8px;
              border-radius: 9999px;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 4px 6px rgba(0,0,0,0.25);
              border: 2px solid white;
              transform: ${isSelected ? 'scale(1.15)' : 'scale(1)'};
              transition: transform 0.2s;
            ">
              ${p.paguCompact}
            </div>
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid ${isSelected ? '#dc2626' : '#0369a1'};
              margin-top: -1px;
            "></div>
          </div>
        `,
        iconSize: [80, 36],
        iconAnchor: [40, 36],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);

      // Popup ringkasan proyek
      marker.bindTooltip(
        `<div style="font-weight: 700; color: #0f172a;">${p.title}</div>
         <div style="font-size: 11px; color: #64748b;">${p.satker}</div>
         <div style="font-size: 11px; font-weight: 600; color: #0369a1; margin-top: 2px;">Pagu: ${p.paguCompact}</div>`,
        { direction: 'top', offset: [0, -36] },
      );

      marker.on('click', () => {
        onSelect(p.id);
      });

      markersRef.current.set(p.id, marker);
      bounds.extend([lat, lng]);
    });

    // Panning ke proyek yang dipilih jika ada
    if (selectedId) {
      const selectedProj = projects.find((x) => x.id === selectedId);
      if (selectedProj?.mapCoordinates?.lat && selectedProj?.mapCoordinates?.lng) {
        map.panTo([selectedProj.mapCoordinates.lat, selectedProj.mapCoordinates.lng], {
          animate: true,
          duration: 0.8,
        });
      }
    }
  }, [projects, selectedId, onSelect]);

  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      <div ref={containerRef} className="h-full w-full z-0" />
    </div>
  );
}
