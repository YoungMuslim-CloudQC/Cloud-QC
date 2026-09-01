import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export { STATE_NAMES, STATE_CODES, NAME_TO_CODE, isStateCode } from "@/lib/us-states";
import { STATE_NAMES } from "@/lib/us-states";

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

/** All state outlines as a single FeatureCollection (for the country map). */
export function allStatesCollection(
  topo: Topology,
): FeatureCollection<Geometry> {
  return feature(
    topo,
    topo.objects.states as GeometryCollection,
  ) as FeatureCollection<Geometry>;
}

/** The GeoJSON outline for a 2-letter state code, or null if unknown. */
export function stateFeature(
  topo: Topology,
  code: string | null | undefined,
): Feature<Geometry> | null {
  const name = code ? STATE_NAMES[code.toUpperCase()] : undefined;
  if (!name) return null;
  return (
    allStatesCollection(topo).features.find(
      (f) => (f.properties as { name?: string } | null)?.name === name,
    ) ?? null
  );
}
