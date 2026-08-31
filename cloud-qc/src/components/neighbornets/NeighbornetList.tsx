import Link from "next/link";

import { db } from "@/lib/db";

export async function NeighbornetList({ activeId }: { activeId?: string }) {
  const neighbornets = await db.neighbornet.findMany({
    where: { archivedAt: null },
    orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
    select: { id: true, name: true, subArea: true },
  });

  if (neighbornets.length === 0) {
    return (
      <div className="empty-state">
        <strong>Nothing here yet</strong>
        An admin needs to add the first neighbornet.
      </div>
    );
  }

  return (
    <div className="nn-select-list">
      {neighbornets.map((n) => (
        <Link
          key={n.id}
          href={`/neighbornets/${n.id}`}
          className={`nn-select-item${n.id === activeId ? " active" : ""}`}
        >
          <div className="nsi-name">{n.name}</div>
          <div className="nsi-city">{n.subArea}</div>
        </Link>
      ))}
    </div>
  );
}
