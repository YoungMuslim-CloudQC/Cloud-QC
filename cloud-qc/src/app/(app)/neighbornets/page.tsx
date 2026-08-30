import { db } from "@/lib/db";
import { PageHead } from "@/components/PageHead";

export default async function NeighbornetsPage() {
  const neighbornets = await db.neighbornet.findMany({
    where: { archivedAt: null },
    orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHead
        title="Neighbornets"
        desc="All local groups, their visit history, and attendance trend."
      />
      <div className="card">
        <div className="section-label">All neighbornets</div>
        {neighbornets.length === 0 ? (
          <div className="empty-state">
            <strong>Nothing here yet</strong>
            An admin needs to add the first neighbornet.
          </div>
        ) : (
          <div className="nn-select-list">
            {neighbornets.map((n) => (
              <div key={n.id} className="nn-select-item">
                <div className="nsi-name">{n.name}</div>
                <div className="nsi-city">
                  {n.subArea}
                  {n.stateCode ? ` · ${n.stateCode}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
