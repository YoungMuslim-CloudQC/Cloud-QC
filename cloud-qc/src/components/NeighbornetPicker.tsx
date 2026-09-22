"use client";

import { useState } from "react";

import type { RegionMap } from "@/lib/queries";
import { SubRegionSelect } from "@/components/SubRegionSelect";
import { AREA_ALL, matchesArea, parseArea } from "@/lib/sub-regions";

export type PickableNeighbornet = {
  id: string;
  name: string;
  subArea: string | null;
  region: string;
};

/** Sub-region first, then neighbornet(s) within it — chips for what's picked.
 *  Controlled: the caller owns the selected ids. */
export function NeighbornetPicker({
  neighbornets,
  regionMap,
  selectedIds,
  onChange,
  initialArea = AREA_ALL,
  emptyHint = "Pick a sub-region, then the neighbornet.",
}: {
  neighbornets: PickableNeighbornet[];
  regionMap: RegionMap;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  initialArea?: string;
  emptyHint?: string;
}) {
  const [area, setArea] = useState(initialArea);

  const byId = new Map(neighbornets.map((n) => [n.id, n]));
  const pickable = neighbornets.filter(
    (n) => matchesArea(n, area) && !selectedIds.includes(n.id),
  );
  const single = parseArea(area).kind === "sub";

  return (
    <div>
      <div className="nn-picker-row">
        <SubRegionSelect
          regionMap={regionMap}
          value={area}
          onChange={setArea}
          emptyLabel="All sub-regions"
          allowWholeState
        />
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onChange([...selectedIds, e.target.value]);
          }}
        >
          <option value="">
            {pickable.length === 0 ? "No neighbornets here" : "Add a neighbornet…"}
          </option>
          {pickable.map((n) => (
            <option key={n.id} value={n.id}>
              {single || !n.subArea ? n.name : `${n.name} — ${n.subArea}`}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {selectedIds.map((id) => {
          const n = byId.get(id);
          return (
            <span className="chip" key={id}>
              {n ? (n.subArea ? `${n.name} — ${n.subArea}` : n.name) : "Unknown"}
              <button
                type="button"
                className="chip-remove"
                onClick={() => onChange(selectedIds.filter((x) => x !== id))}
              >
                ×
              </button>
            </span>
          );
        })}
        {selectedIds.length === 0 && (
          <span className="survey-time-note">{emptyHint}</span>
        )}
      </div>
    </div>
  );
}
