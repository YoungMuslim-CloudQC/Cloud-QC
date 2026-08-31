import Link from "next/link";

import { requireApproved } from "@/lib/authz";
import { PageHead } from "@/components/PageHead";
import { NeighbornetList } from "@/components/neighbornets/NeighbornetList";

export const dynamic = "force-dynamic";

export default async function NeighbornetsPage() {
  const user = await requireApproved();
  const isAdmin = user.role === "ADMIN";

  return (
    <>
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
          <div className="section-label">All neighbornets</div>
          <NeighbornetList />
        </div>
        <div className="card">
          <div className="empty-state">
            <strong>No neighbornet selected</strong>
            Pick one from the list to see its history.
          </div>
        </div>
      </div>
    </>
  );
}
