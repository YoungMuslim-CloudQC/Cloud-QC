import { requireApproved } from "@/lib/authz";
import { getNeighbornetSummaries } from "@/lib/queries";
import { isoDate } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import { type MapNeighbornet } from "@/components/NetworkMap";
import { type StateStat } from "@/components/CountryMap";
import { MapViewSwitcher } from "@/components/MapViewSwitcher";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  await requireApproved();
  const summaries = await getNeighbornetSummaries();

  const data: MapNeighbornet[] = summaries.map((n) => ({
    id: n.id,
    name: n.name,
    subArea: n.subArea ?? "",
    region: n.region,
    stateCode: n.stateCode,
    latitude: n.latitude,
    longitude: n.longitude,
    status: n.displayStatus,
    lastVisitDate: n.latestVisit ? isoDate(n.latestVisit.visitDate) : null,
    partners: n.partners.map((p) => p.name),
  }));

  const stateStats: Record<string, StateStat> = {};
  for (const n of summaries) {
    const code = n.stateCode?.toUpperCase();
    if (!code) continue;
    const s =
      stateStats[code] ??
      (stateStats[code] = {
        total: 0,
        onTrack: 0,
        needsFollowup: 0,
        urgent: 0,
        unrated: 0,
      });
    s.total += 1;
    if (n.displayStatus === "ON_TRACK") s.onTrack += 1;
    else if (n.displayStatus === "NEEDS_FOLLOWUP") s.needsFollowup += 1;
    else if (n.displayStatus === "URGENT") s.urgent += 1;
    else s.unrated += 1;
  }

  return (
    <>
      <PageHead
        title="Network Map"
        desc="Country view highlights states with neighbornets; drill into a state for the pin-level map."
      />
      <MapViewSwitcher neighbornets={data} stateStats={stateStats} />
    </>
  );
}
