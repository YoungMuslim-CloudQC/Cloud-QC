import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming", DC: "District of Columbia",
};

/** All 2-letter codes we can render, for the "add a new state" picker. */
export const STATE_CODES = Object.keys(STATE_NAMES).sort();

let topoCache: Topology | null = null;
let topoPending: Promise<Topology> | null = null;

/** Lazily load and memoize the us-atlas states TopoJSON (client-side). */
export async function loadStatesTopo(): Promise<Topology> {
  if (topoCache) return topoCache;
  if (!topoPending) {
    topoPending = import("us-atlas/states-10m.json").then((m) => {
      topoCache = m.default as unknown as Topology;
      return topoCache;
    });
  }
  return topoPending;
}

/** The GeoJSON outline for a 2-letter state code, or null if unknown. */
export function stateFeature(
  topo: Topology,
  code: string | null | undefined,
): Feature<Geometry> | null {
  const name = code ? STATE_NAMES[code.toUpperCase()] : undefined;
  if (!name) return null;
  const fc = feature(
    topo,
    topo.objects.states as GeometryCollection,
  ) as FeatureCollection<Geometry>;
  return (
    fc.features.find(
      (f) => (f.properties as { name?: string } | null)?.name === name,
    ) ?? null
  );
}
