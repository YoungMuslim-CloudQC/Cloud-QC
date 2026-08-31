import { requireApproved } from "@/lib/authz";
import { getNeighbornetSummaries } from "@/lib/queries";
import { isoDate } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import { NetworkMap, type MapNeighbornet } from "@/components/NetworkMap";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  await requireApproved();
  const summaries = await getNeighbornetSummaries();

  const data: MapNeighbornet[] = summaries.map((n) => ({
    id: n.id,
    name: n.name,
    subArea: n.subArea,
    region: n.region,
    stateCode: n.stateCode,
    latitude: n.latitude,
    longitude: n.longitude,
    latestStatus: n.latestVisit?.status ?? null,
    lastVisitDate: n.latestVisit ? isoDate(n.latestVisit.visitDate) : null,
    partners: n.partners.map((p) => p.name),
  }));

  return (
    <>
      <PageHead
        title="Network Map"
        desc="Real state outlines, glowing pins for each neighbornet — green / amber / red shows current status."
      />
      <NetworkMap neighbornets={data} />
    </>
  );
}
