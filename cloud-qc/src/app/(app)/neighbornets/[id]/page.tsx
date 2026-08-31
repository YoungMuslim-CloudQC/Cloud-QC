import { requireApproved } from "@/lib/authz";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import { NeighbornetList } from "@/components/neighbornets/NeighbornetList";
import { NeighbornetDetail } from "@/components/neighbornets/NeighbornetDetail";
import { AddNeighbornetForm } from "@/components/neighbornets/AddNeighbornetForm";

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
        <div className="card" style={{ marginBottom: 20, maxWidth: 640 }}>
          <div className="section-label">
            Add a neighbornet{" "}
            <span className="badge badge-neutral">Admin only</span>
          </div>
          <AddNeighbornetForm />
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
