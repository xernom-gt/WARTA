import { FlaskConical, RotateCcw } from 'lucide-react';
import { useWarta } from '../../context/WartaContext';
import type { MapCondition, UserRole } from '../../types/warta';

const ROLES: { v: UserRole; l: string }[] = [
  { v: 'other', l: 'Warga Lain' },
  { v: 'owner', l: 'Pemilik Laporan' },
  { v: 'guest', l: 'Tamu' },
];
const CONDITIONS: { v: MapCondition; l: string }[] = [
  { v: 'normal', l: 'Normal' },
  { v: 'gps-denied', l: 'GPS Ditolak' },
  { v: 'filter-empty', l: 'Filter Kosong' },
  { v: 'tile-error', l: 'Peta Error' },
  { v: 'loading', l: 'Memuat' },
];

/** Toolbar penguji state untuk demo / juri. */
export default function DevSimulatorBar() {
  const { role, setRole, mapCondition, setMapCondition, reset } = useWarta();
  return (
    <div className="border-b border-amber-300 bg-amber-50 text-xs text-amber-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <span className="flex items-center gap-1 font-bold"><FlaskConical className="size-3.5" />Simulator</span>
        <label className="flex items-center gap-1.5">
          Peran:
          <select id="sim-role" value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="rounded border border-amber-300 bg-white px-1.5 py-0.5">
            {ROLES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Kondisi Peta:
          <select id="sim-map" value={mapCondition} onChange={(e) => setMapCondition(e.target.value as MapCondition)} className="rounded border border-amber-300 bg-white px-1.5 py-0.5">
            {CONDITIONS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </label>
        <button id="sim-reset" onClick={reset} className="ml-auto flex items-center gap-1 rounded border border-amber-300 bg-white px-2 py-0.5 font-semibold hover:bg-amber-100">
          <RotateCcw className="size-3" /> Reset
        </button>
      </div>
    </div>
  );
}
