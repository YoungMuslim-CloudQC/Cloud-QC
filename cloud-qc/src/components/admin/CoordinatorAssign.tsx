"use client";

import { useState, useTransition } from "react";

import type { RegionMap } from "@/lib/queries";
import { flattenRegionMap } from "@/lib/sub-regions";
import {
  NeighbornetPicker,
  type PickableNeighbornet,
} from "@/components/NeighbornetPicker";
import {
  setCoordinatorNeighbornet,
  setSrCoordinatorSubregion,
} from "@/server/actions/admin";

/** The two coordinator-side seats an admin can hand out directly: one
 *  neighbornet (COORDINATOR) and/or one sub-region (SR_COORDINATOR). Core
 *  team seats aren't set here — a coordinator or SRC invites those
 *  themselves. Either seat makes the account view-only. */
export function CoordinatorAssign({
  userId,
  initialId,
  initialSubregion,
  neighbornets,
  regionMap,
}: {
  userId: string;
  initialId: string | null;
  initialSubregion: string | null;
  neighbornets: PickableNeighbornet[];
  regionMap: RegionMap;
}) {
  const [ids, setIds] = useState<string[]>(initialId ? [initialId] : []);
  const [subregion, setSubregion] = useState(initialSubregion ?? "");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const subAreas = flattenRegionMap(regionMap).map((s) => s.subArea);
  const nnDirty = (ids[0] ?? null) !== initialId;
  const subDirty = subregion !== (initialSubregion ?? "");

  function save() {
    setMsg(null);
    startTransition(async () => {
      const results: string[] = [];
      if (nnDirty) {
        const res = await setCoordinatorNeighbornet(userId, ids[0] ?? null);
        if (!res.ok) results.push(res.error ?? "Couldn't set the neighbornet.");
      }
      if (subDirty) {
        const res = await setSrCoordinatorSubregion(userId, subregion || null);
        if (!res.ok) results.push(res.error ?? "Couldn't set the sub-region.");
      }
      setMsg(results.length ? results.join(" ") : "Saved.");
    });
  }

  return (
    <div className="coord-assign">
      <div className="coord-assign-label">Coordinator of (one neighbornet)</div>
      <NeighbornetPicker
        neighbornets={neighbornets}
        regionMap={regionMap}
        selectedIds={ids}
        onChange={(next) => {
          // One seat per person: a later pick replaces the earlier one.
          setIds(next.slice(-1));
          setMsg(null);
        }}
        emptyHint="Not a coordinator of any neighbornet."
      />

      <div className="coord-assign-label" style={{ marginTop: 12 }}>
        SR coordinator of (one sub-region)
      </div>
      <select
        value={subregion}
        onChange={(e) => {
          setSubregion(e.target.value);
          setMsg(null);
        }}
      >
        <option value="">Not an SR coordinator</option>
        {subAreas.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          style={{ width: "auto" }}
          disabled={pending || (!nnDirty && !subDirty)}
          onClick={save}
        >
          {pending ? "Saving…" : "Save roles"}
        </button>
        {msg && <span className="survey-time-note">{msg}</span>}
      </div>
    </div>
  );
}
