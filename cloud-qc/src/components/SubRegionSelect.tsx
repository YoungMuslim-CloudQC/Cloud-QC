"use client";

import type { RegionMap } from "@/lib/queries";
import { stateValue, subValue } from "@/lib/sub-regions";

/**
 * The one short "where?" list used across the app: flat states are a plain
 * option, split states (NJ/NY/TX) group their sub-regions under the state.
 * Values are sub-region filter strings (see lib/sub-regions).
 */
export function SubRegionSelect({
  regionMap,
  value,
  onChange,
  emptyLabel,
  allowWholeState = false,
  id,
  disabled,
}: {
  regionMap: RegionMap;
  value: string;
  onChange: (value: string) => void;
  /** Label for the "" option — e.g. "All areas" or "Choose a sub-region…". */
  emptyLabel: string;
  /** Add an "All of <state>" option at the top of each split state's group. */
  allowWholeState?: boolean;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{emptyLabel}</option>
      {regionMap.map((r) =>
        r.subAreas.length > 1 ? (
          <optgroup key={r.region} label={r.region}>
            {allowWholeState && (
              <option value={stateValue(r.region)}>All of {r.region}</option>
            )}
            {r.subAreas.map((a) => (
              <option key={a} value={subValue(a)}>
                {a}
              </option>
            ))}
          </optgroup>
        ) : (
          <option key={r.region} value={subValue(r.subAreas[0] ?? r.region)}>
            {r.region}
          </option>
        ),
      )}
    </select>
  );
}
