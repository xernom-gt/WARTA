import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ProjectPackage } from '../../types/warta';

interface Props {
  projects: ProjectPackage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  heightClass?: string;
}

export default function OpenStreetMapExplorer({
  projects,
  selectedId,
  onSelect,
  heightClass = 'h-[460px] sm:h-[540px] lg:h-[620px]',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Inisialisasi Map Leaflet
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Pusat Jakarta (-6.2088, 106.8456)
    const map = L.map(containerRef.current, {
      center: [-6.2088, 106.8456],
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

    L.control
      .attribution({ position: 'bottomright', prefix: false })
      .addAttribution('© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>')
      .addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Markers ketika projects atau selectedId berubah
  useEffect(() => {
    const map = mapRef.current;
    const group = markersLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    projects.forEach((p) => {
      const lat = p.mapCoordinates?.lat;
      const lng = p.mapCoordinates?.lng;
      if (!lat || !lng) return;

      const isSelected = p.id === selectedId;

      const pinColor =
        p.status === 'selesai'
          ? '#059669' // emerald
          : p.status === 'terverifikasi'
            ? '#0284c7' // sky/brand
            : '#d97706'; // amber (menunggu)

      const customIcon = L.divIcon({
        className: 'warta-project-marker',
        html: `
          <div style="position: relative; cursor: pointer; transition: transform 0.15s ease;">
            <div style="
              background: ${pinColor};
              width: ${isSelected ? '38px' : '30px'};
              height: ${isSelected ? '38px' : '30px'};
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: ${isSelected ? '3.5px solid #ffffff' : '2.5px solid #ffffff'};
              box-shadow: 0 4px 12px rgba(0,0,0,0.35);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                width: ${isSelected ? '12px' : '9px'};
                height: ${isSelected ? '12px' : '9px'};
                background: #ffffff;
                border-radius: 50%;
              "></div>
            </div>
            <div style="
              position: absolute;
              bottom: -6px;
              left: 50%;
              transform: translateX(-50%);
              width: 14px;
              height: 4px;
              background: rgba(0,0,0,0.25);
              border-radius: 50%;
              filter: blur(1px);
            "></div>
          </div>
        `,
        iconSize: isSelected ? [38, 38] : [30, 30],
        iconAnchor: isSelected ? [19, 38] : [15, 30],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      // Tooltip informatif
      marker.bindTooltip(
        `
        <div style="font-family: inherit; font-size: 11px; padding: 2px;">
          <strong style="color: #0f172a; display: block; font-size: 12px; margin-bottom: 2px;">${p.title}</strong>
          <span style="color: #0284c7; font-weight: 700; display: block;">${p.paguCompact}</span>
          <span style="color: #64748b; font-size: 10px;">${p.satker}</span>
        </div>
      `,
        { direction: 'top', offset: [0, -28], opacity: 0.95 },
      );

      marker.on('click', () => {
        onSelect(p.id);
      });

      marker.addTo(group);
    });
  }, [projects, selectedId, onSelect]);

  // Terbang ke koordinat proyek jika dipilih
  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const selectedProj = projects.find((p) => p.id === selectedId);
    if (selectedProj?.mapCoordinates?.lat && selectedProj?.mapCoordinates?.lng) {
      mapRef.current.flyTo(
        [selectedProj.mapCoordinates.lat, selectedProj.mapCoordinates.lng],
        14,
        { duration: 0.9 },
      );
    }
  }, [selectedId, projects]);

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-xs`}>
      <div ref={containerRef} className="h-full w-full z-0" />
    </div>
  );
}
