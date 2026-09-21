"use client";

import { useRouter } from "next/navigation";

import type { RegionMap } from "@/lib/queries";
import { SubRegionSelect } from "@/components/SubRegionSelect";

/** Step one on the Neighbornets pages: choose a sub-region (or "All"). The
 *  choice lives in the URL so it survives clicking into a neighbornet. */
export function AreaPicker({
  regionMap,
  value,
}: {
  regionMap: RegionMap;
  value: string;
}) {
  const router = useRouter();
  return (
    <div className="area-picker">
      <label htmlFor="area-picker-select">Sub-region</label>
      <SubRegionSelect
        id="area-picker-select"
        regionMap={regionMap}
        value={value}
        emptyLabel="All sub-regions"
        allowWholeState
        onChange={(v) => router.push(`/neighbornets?area=${encodeURIComponent(v)}`)}
      />
    </div>
  );
}
