import type { RegionMap } from "@/lib/queries";

/** A sub-region is what members think of as "where": Illinois, North New
 *  Jersey, Dallas… It's Neighbornet.subArea; `region` is the state it sits in. */
export type SubRegion = { subArea: string; region: string };

export function flattenRegionMap(regionMap: RegionMap): SubRegion[] {
  return regionMap.flatMap((r) =>
    r.subAreas.map((subArea) => ({ subArea, region: r.region })),
  );
}

/** Area filter values: "" = everything, "sub:<subArea>", "state:<region>" (a
 *  whole split state, e.g. all of Texas). One string so it can live in a URL. */
export const AREA_ALL = "";

export function subValue(subArea: string) {
  return `sub:${subArea}`;
}
export function stateValue(region: string) {
  return `state:${region}`;
}

export function parseArea(
  value: string | null | undefined,
): { kind: "all" } | { kind: "sub"; subArea: string } | { kind: "state"; region: string } {
  if (value?.startsWith("sub:")) return { kind: "sub", subArea: value.slice(4) };
  if (value?.startsWith("state:")) return { kind: "state", region: value.slice(6) };
  return { kind: "all" };
}

export function matchesArea(
  n: { region: string; subArea: string | null },
  value: string | null | undefined,
): boolean {
  const a = parseArea(value);
  if (a.kind === "sub") return n.subArea === a.subArea;
  if (a.kind === "state") return n.region === a.region;
  return true;
}

export function areaLabel(value: string | null | undefined): string {
  const a = parseArea(value);
  if (a.kind === "sub") return a.subArea;
  if (a.kind === "state") return `All of ${a.region}`;
  return "All areas";
}

/** Prisma `where` fragment for the same filter (server side). */
export function areaWhere(value: string | null | undefined) {
  const a = parseArea(value);
  if (a.kind === "sub") return { subArea: a.subArea };
  if (a.kind === "state") return { region: a.region };
  return {};
}

/** Same filter, but for Visit.subRegion — a plain string (set to either a
 *  shared region name or one NN's own subArea, not a normalized value), so
 *  this matches loosely: any string that could plausibly mean "here". */
export function subRegionMatchValues(
  value: string | null | undefined,
  regionMap: RegionMap,
): string[] | null {
  const a = parseArea(value);
  if (a.kind === "all") return null; // no filter
  if (a.kind === "state") {
    const r = regionMap.find((r) => r.region === a.region);
    return [a.region, ...(r?.subAreas ?? [])];
  }
  const region = flattenRegionMap(regionMap).find((s) => s.subArea === a.subArea)?.region;
  return region ? [a.subArea, region] : [a.subArea];
}
