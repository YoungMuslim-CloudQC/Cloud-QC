"use client";

import { useState, useTransition } from "react";

import type { RegionMap } from "@/lib/queries";
import {
  NeighbornetPicker,
  type PickableNeighbornet,
} from "@/components/NeighbornetPicker";
import { setCoordinatorNeighbornets } from "@/server/actions/admin";

/** Which neighbornet(s) a coordinator runs — the inbox they see is exactly
 *  this set. */
export function CoordinatorAssign({
  userId,
  initialIds,
  neighbornets,
  regionMap,
}: {
  userId: string;
  initialIds: string[];
  neighbornets: PickableNeighbornet[];
  regionMap: RegionMap;
}) {
  const [ids, setIds] = useState(initialIds);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const dirty =
    ids.length !== initialIds.length || ids.some((id) => !initialIds.includes(id));

  function save() {
    setMsg(null);
    startTransition(async () => {
      const res = await setCoordinatorNeighbornets(userId, ids);
      setMsg(res.ok ? "Saved." : (res.error ?? "Couldn't save."));
    });
  }

  return (
    <div className="coord-assign">
      <div className="coord-assign-label">Coordinates</div>
      <NeighbornetPicker
        neighbornets={neighbornets}
        regionMap={regionMap}
        selectedIds={ids}
        onChange={(next) => {
          setIds(next);
          setMsg(null);
        }}
        emptyHint="No neighbornet linked — their inbox will be empty."
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          style={{ width: "auto" }}
          disabled={pending || !dirty}
          onClick={save}
        >
          {pending ? "Saving…" : "Save neighbornets"}
        </button>
        {msg && <span className="survey-time-note">{msg}</span>}
      </div>
    </div>
  );
}
