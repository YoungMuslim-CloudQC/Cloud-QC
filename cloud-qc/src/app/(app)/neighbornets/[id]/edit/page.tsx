import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { getUsedStateCodes } from "@/lib/queries";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import { NeighbornetForm } from "@/components/neighbornets/NeighbornetForm";

export const dynamic = "force-dynamic";

export default async function EditNeighbornetPage({
  params,
}: PageProps<"/neighbornets/[id]/edit">) {
  await requireAdmin();
  const { id } = await params;

  const [nn, existingStates] = await Promise.all([
    db.neighbornet.findUnique({ where: { id } }),
    getUsedStateCodes(),
  ]);
  if (!nn) notFound();

  return (
    <>
      <BackLink href={`/neighbornets/${nn.id}`} label={nn.name} />
      <PageHead
        title={`Edit ${nn.name}`}
        desc="Update details, or click the map to re-place the location pin."
      />
      <div className="card" style={{ maxWidth: 720 }}>
        <NeighbornetForm
          mode="edit"
          existingStates={existingStates}
          initial={{
            id: nn.id,
            name: nn.name,
            city: nn.city,
            region: nn.region,
            subArea: nn.subArea,
            stateCode: nn.stateCode,
            latitude: nn.latitude != null ? Number(nn.latitude) : null,
            longitude: nn.longitude != null ? Number(nn.longitude) : null,
            contactEmail: nn.contactEmail,
            instagram: nn.instagram,
          }}
        />
      </div>
    </>
  );
}
