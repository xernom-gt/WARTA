import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPin, Navigation, RotateCcw } from 'lucide-react';

export interface MiniPinValue {
  x: number;
  y: number;
  lat?: number;
  lng?: number;
  address?: string;
}

interface Props {
  value: MiniPinValue;
  onChange: (v: MiniPinValue) => void;
  estimate?: { x: number; y: number; r: number };
  label?: string;
  centerLat?: number;
  centerLng?: number;
  heightClass?: string;
}

/**
 * Peta Interaktif OpenStreetMap (OSM) via Leaflet untuk Admin & Auditor.
 * Mendukung drag pin presisi, deteksi GPS, reverse geocoding, dan tombol Reset Lokasi.
 */
export default function MiniPinMap({
  value,
  onChange,
  estimate,
  label = 'Geser pin atau klik peta untuk menentukan titik koordinat',
  centerLat,
  centerLng,
  heightClass = 'h-64 sm:h-72',
}: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const isMountedRef = useRef(true);

  const [locating, setLocating] = useState(false);
  const [addressPreview, setAddressPreview] = useState<string>(value.address ?? '');

  const currentLat = value.lat ?? (centerLat ?? -6.8175 - value.y / 1000);
  const currentLng = value.lng ?? (centerLng ?? 107.1425 + value.x / 1000);

  // Simpan titik asal default
  const originRef = useRef<{ lat: number; lng: number; x: number; y: number; address?: string }>({
    lat: centerLat ?? value.lat ?? -6.8175 - value.y / 1000,
    lng: centerLng ?? value.lng ?? 107.1425 + value.x / 1000,
    x: value.x,
    y: value.y,
    address: value.address,
  });

  useEffect(() => {
    if (centerLat !== undefined && centerLng !== undefined) {
      originRef.current = {
        lat: centerLat,
        lng: centerLng,
        x: 50,
        y: 50,
        address: '',
      };
    }
  }, [centerLat, centerLng]);

  // Cek apakah pin bergeser
  const isMoved =
    Math.abs(currentLat - originRef.current.lat) > 0.00008 ||
    Math.abs(currentLng - originRef.current.lng) > 0.00008;

  const reverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          {
            headers: {
              'Accept-Language': 'id,en',
            },
          },
        );
        if (!res.ok) return;
        const data = await res.json();
        if (isMountedRef.current && data?.display_name) {
          const parts = data.display_name.split(', ');
          const shortAddr = parts.slice(0, 3).join(', ');
          setAddressPreview(shortAddr);
          return shortAddr;
        }
      } catch {
        // Fallback jika offline
      }
      return undefined;
    },
    [],
  );

  const updatePosition = useCallback(
    async (lat: number, lng: number) => {
      const x = Math.round(Math.min(98, Math.max(2, (lng - 107.1425) * 1000)) * 10) / 10;
      const y = Math.round(Math.min(98, Math.max(2, (-6.8175 - lat) * 1000)) * 10) / 10;

      const addr = await reverseGeocode(lat, lng);
      if (!isMountedRef.current) return;
      onChange({
        x: Number.isFinite(x) ? x : value.x,
        y: Number.isFinite(y) ? y : value.y,
        lat,
        lng,
        address: addr ?? addressPreview,
      });
    },
    [onChange, reverseGeocode, value.x, value.y, addressPreview],
  );

  useEffect(() => {
    isMountedRef.current = true;
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [currentLat, currentLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
    }).addTo(map);

    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const customPinIcon = L.divIcon({
      className: 'warta-pin-wrapper',
      html: `
        <div style="position: relative; width: 34px; height: 34px; cursor: grab;">
          <div style="
            background: #0284c7;
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid #ffffff;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="width: 10px; height: 10px; background: #ffffff; border-radius: 50%;"></div>
          </div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });

    const marker = L.marker([currentLat, currentLng], {
      draggable: true,
      icon: customPinIcon,
    }).addTo(map);
    markerRef.current = marker;

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      updatePosition(pos.lat, pos.lng);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      updatePosition(lat, lng);
    });

    if (estimate) {
      const circle = L.circle([currentLat, currentLng], {
        radius: 350,
        color: '#64748b',
        dashArray: '5, 5',
        fillColor: '#94a3b8',
        fillOpacity: 0.12,
        weight: 1.5,
      }).addTo(map);
      circleRef.current = circle;
    }

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value.lat && value.lng && markerRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (
        Math.abs(currentPos.lat - value.lat) > 0.00001 ||
        Math.abs(currentPos.lng - value.lng) > 0.00001
      ) {
        markerRef.current.setLatLng([value.lat, value.lng]);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo([value.lat, value.lng]);
        }
      }
    }
  }, [value.lat, value.lng]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!isMountedRef.current) return;
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 17, { duration: 1.2 });
          markerRef.current.setLatLng([latitude, longitude]);
        }
        updatePosition(latitude, longitude);
      },
      () => {
        if (isMountedRef.current) setLocating(false);
      },
      { enableHighAccuracy: true },
    );
  };

  const handleResetLocation = async () => {
    const origin = originRef.current;
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([origin.lat, origin.lng], 16, { duration: 0.8 });
      markerRef.current.setLatLng([origin.lat, origin.lng]);
    }
    const addr = origin.address || (await reverseGeocode(origin.lat, origin.lng));
    if (isMountedRef.current && addr) {
      setAddressPreview(addr);
    }
    onChange({
      x: origin.x,
      y: origin.y,
      lat: origin.lat,
      lng: origin.lng,
      address: addr,
    });
  };

  return (
    <div className="space-y-2">
      <div className={`relative w-full ${heightClass} overflow-hidden rounded-2xl border border-slate-300 bg-slate-100 shadow-xs`}>
        <div ref={mapContainerRef} className="h-full w-full z-0" />
        <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            title="Kunci titik lokasi GPS saya"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold text-slate-800 shadow-md backdrop-blur-xs transition hover:bg-slate-50 hover:text-brand disabled:opacity-60 cursor-pointer"
          >
            {locating ? (
              <Loader2 className="size-3.5 animate-spin text-brand" />
            ) : (
              <Navigation className="size-3.5 text-brand fill-brand" />
            )}
            <span>{locating ? 'Mencari GPS...' : 'Titik Saya'}</span>
          </button>

          {isMoved && (
            <button
              type="button"
              onClick={handleResetLocation}
              title="Kembalikan pin ke titik lokasi awal semula"
              className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-white/95 px-3 py-2 text-xs font-bold text-amber-800 shadow-md backdrop-blur-xs transition hover:bg-amber-50 hover:border-amber-300 cursor-pointer"
            >
              <RotateCcw className="size-3.5 text-amber-600" />
              <span>Reset Lokasi</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-1.5 min-w-0">
          <MapPin className="size-3.5 shrink-0 text-brand" />
          <span className="truncate">{addressPreview ? addressPreview : label}</span>
        </div>
        <div className="flex items-center gap-2">
          {isMoved && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
              Pin telah digeser
            </span>
          )}
          <div className="shrink-0 font-mono text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
            {currentLat.toFixed(6)}, {currentLng.toFixed(6)}
          </div>
        </div>
      </div>
    </div>
  );
}
