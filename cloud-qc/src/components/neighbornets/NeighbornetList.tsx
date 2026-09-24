import Link from "next/link";

import { db } from "@/lib/db";
import { areaWhere, parseArea } from "@/lib/sub-regions";

export async function NeighbornetList({
  activeId,
  area = "",
  stage = "",
}: {
  activeId?: string;
  /** Sub-region filter value (see lib/sub-regions). "" = every neighbornet. */
  area?: string;
  /** "" = both stages, "ACTIVE", or "EXPANSION". */
  stage?: "" | "ACTIVE" | "EXPANSION";
}) {
  const neighbornets = await db.neighbornet.findMany({
    where: {
      archivedAt: null,
      ...areaWhere(area),
      ...(stage ? { stage } : {}),
    },
    orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
    select: { id: true, name: true, subArea: true, stage: true },
  });

  if (neighbornets.length === 0) {
    return (
      <div className="empty-state">
        <strong>Nothing here yet</strong>
        No neighbornets in this sub-region.
      </div>
    );
  }

  const singleSub = parseArea(area).kind === "sub";
  const query = `?area=${encodeURIComponent(area)}`;

  return (
    <div className="nn-select-list">
      {neighbornets.map((n) => (
        <Link
          key={n.id}
          href={`/neighbornets/${n.id}${query}`}
          className={`nn-select-item${n.id === activeId ? " active" : ""}`}
        >
          <div className="nsi-name">
            {n.name}
            {n.stage === "EXPANSION" && (
              <span className="badge badge-event" style={{ marginLeft: 6 }}>
                Expansion
              </span>
            )}
          </div>
          {!singleSub && <div className="nsi-city">{n.subArea}</div>}
        </Link>
      ))}
    </div>
  );
}
