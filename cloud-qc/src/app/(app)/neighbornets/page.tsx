import Link from "next/link";

import { db } from "@/lib/db";
import { requireApproved } from "@/lib/authz";
import { getRegionMap } from "@/lib/queries";
import { areaLabel, subValue } from "@/lib/sub-regions";
import { EVENT_TYPES, type EventTypeValue } from "@/lib/visit-schema";
import { PageHead } from "@/components/PageHead";
import { AreaPicker } from "@/components/neighbornets/AreaPicker";
import { AreaFeed } from "@/components/neighbornets/AreaFeed";
import { NeighbornetList } from "@/components/neighbornets/NeighbornetList";

export const dynamic = "force-dynamic";

const STAGE_LABEL = { "": "All", ACTIVE: "Active", EXPANSION: "Expansions" } as const;

export default async function NeighbornetsPage({
  searchParams,
}: PageProps<"/neighbornets">) {
  const user = await requireApproved();
  const isAdmin = user.role === "ADMIN";
  const { area: areaParam, type: typeParam, stage: stageParam } = await searchParams;

  const [regionMap, me] = await Promise.all([
    getRegionMap(),
    db.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { homeSubArea: true },
    }),
  ]);

  // No explicit choice yet → start on the member's home sub-region. An
  // explicit empty value ("?area=") means they picked "All".
  const area =
    typeof areaParam === "string"
      ? areaParam
      : me.homeSubArea
        ? subValue(me.homeSubArea)
        : "";
  const type = EVENT_TYPES.find((t) => t === typeParam) as EventTypeValue | undefined;
  const stage = (["ACTIVE", "EXPANSION"] as const).find((s) => s === stageParam) ?? "";

  return (
    <>
      <PageHead
        title="Neighbornets"
        desc="Pick a sub-region to see its feedback, then open a single neighbornet."
      />

      <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {isAdmin && (
          <Link className="btn btn-secondary btn-small" href="/neighbornets/new">
            + Add a neighbornet
          </Link>
        )}
        <a
          className="btn btn-secondary btn-small"
          href={`/api/export/visits${area ? `?area=${encodeURIComponent(area)}` : ""}`}
        >
          Export {area ? `${areaLabel(area)} ` : "all "}feedback (CSV)
        </a>
      </div>

      <div className="two-col">
        <div className="card">
          <AreaPicker regionMap={regionMap} value={area} />
          <div className="section-label" style={{ marginTop: 14 }}>
            {areaLabel(area)}
          </div>
          <div className="status-options" style={{ marginBottom: 12 }}>
            {(Object.keys(STAGE_LABEL) as (keyof typeof STAGE_LABEL)[]).map((s) => {
              const params = new URLSearchParams({ area });
              if (s) params.set("stage", s);
              return (
                <Link
                  key={s || "all"}
                  href={`/neighbornets?${params.toString()}`}
                  className={`status-opt${stage === s ? " sel-ok" : ""}`}
                  style={{ textDecoration: "none" }}
                >
                  {STAGE_LABEL[s]}
                </Link>
              );
            })}
          </div>
          <NeighbornetList area={area} stage={stage} />
        </div>
        <div className="card">
          <AreaFeed area={area} type={type ?? ""} />
        </div>
      </div>
    </>
  );
}
