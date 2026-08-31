import Link from "next/link";

import { requireApproved } from "@/lib/authz";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import { NeighbornetList } from "@/components/neighbornets/NeighbornetList";
import { NeighbornetDetail } from "@/components/neighbornets/NeighbornetDetail";

export const dynamic = "force-dynamic";

export default async function NeighbornetPage({
  params,
}: PageProps<"/neighbornets/[id]">) {
  const user = await requireApproved();
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;

  return (
    <>
      <BackLink href="/neighbornets" label="Neighbornets" />
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
          <NeighbornetList activeId={id} />
        </div>
        <div className="card">
          <NeighbornetDetail id={id} isAdmin={isAdmin} />
        </div>
      </div>
    </>
  );
}
