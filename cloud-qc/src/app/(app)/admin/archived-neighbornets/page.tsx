import { requireAdmin } from "@/lib/authz";
import { getNeighbornetSummaries } from "@/lib/queries";
import { isoDate } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import { NetworkMap, type MapNeighbornet } from "@/components/NetworkMap";

export const dynamic = "force-dynamic";

export default async function ArchivedNeighbornetsPage() {
  await requireAdmin();
  const summaries = await getNeighbornetSummaries({ archived: true });

  const data: MapNeighbornet[] = summaries.map((n) => ({
    id: n.id,
    name: n.name,
    subArea: n.subArea,
    region: n.region,
    stateCode: n.stateCode,
    latitude: n.latitude,
    longitude: n.longitude,
    // Status isn't operationally meaningful for an archived neighbornet.
    status: null,
    lastVisitDate: n.latestVisit ? isoDate(n.latestVisit.visitDate) : null,
    partners: n.partners.map((p) => p.name),
  }));

  return (
    <>
      <PageHead
        title="Archived neighbornets"
        desc="Archived groups, shown on the map with muted pins. Their past visits still count in every stat; they're just hidden from active use."
      />
      <NetworkMap
        neighbornets={data}
        muted
        emptyLabel={{
          title: "Nothing archived",
          body: "Archive a neighbornet from its detail page and it will appear here.",
        }}
      />
    </>
  );
}
