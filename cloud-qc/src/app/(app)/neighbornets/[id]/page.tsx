import Link from "next/link";

import { db } from "@/lib/db";
import { requireApproved } from "@/lib/authz";
import { getRegionMap } from "@/lib/queries";
import { areaLabel, subValue } from "@/lib/sub-regions";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import { AreaPicker } from "@/components/neighbornets/AreaPicker";
import { NeighbornetList } from "@/components/neighbornets/NeighbornetList";
import { NeighbornetDetail } from "@/components/neighbornets/NeighbornetDetail";

export const dynamic = "force-dynamic";

export default async function NeighbornetPage({
  params,
  searchParams,
}: PageProps<"/neighbornets/[id]">) {
  const user = await requireApproved();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const { area: areaParam } = await searchParams;

  // Keep the list on the sub-region the member was browsing; a direct link
  // falls back to this neighbornet's own sub-region.
  const [regionMap, nn] = await Promise.all([
    getRegionMap(),
    db.neighbornet.findUnique({ where: { id }, select: { subArea: true } }),
  ]);
  const area =
    typeof areaParam === "string"
      ? areaParam
      : nn?.subArea
        ? subValue(nn.subArea)
        : "";

  return (
    <>
      <BackLink
        href={`/neighbornets?area=${encodeURIComponent(area)}`}
        label="Neighbornets"
      />
      <PageHead
        title="Neighbornets"
        desc="All local groups, their visit history, and attendance trend."
      />

      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <Link className="btn btn-secondary btn-small" href="/neighbornets/new">
            + Add a neighbornet
          </Link>
        </div>
      )}

      <div className="two-col">
        <div className="card">
          <AreaPicker regionMap={regionMap} value={area} />
          <div className="section-label" style={{ marginTop: 14 }}>
            {areaLabel(area)}
          </div>
          <NeighbornetList activeId={id} area={area} />
        </div>
        <div className="card">
          <NeighbornetDetail id={id} isAdmin={isAdmin} />
        </div>
      </div>
    </>
  );
}
