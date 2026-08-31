import { requireAdmin } from "@/lib/authz";
import { getUsedStateCodes } from "@/lib/queries";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import { NeighbornetForm } from "@/components/neighbornets/NeighbornetForm";

export const dynamic = "force-dynamic";

export default async function NewNeighbornetPage() {
  await requireAdmin();
  const existingStates = await getUsedStateCodes();

  return (
    <>
      <BackLink href="/neighbornets" label="Neighbornets" />
      <PageHead
        title="Add a neighbornet"
        desc="Pick the state, then click the map to drop a pin on the exact location."
      />
      <div className="card" style={{ maxWidth: 720 }}>
        <NeighbornetForm mode="create" existingStates={existingStates} />
      </div>
    </>
  );
}
