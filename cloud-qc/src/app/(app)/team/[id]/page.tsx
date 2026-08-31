import { requireApproved } from "@/lib/authz";
import { getTeamMemberStats } from "@/lib/queries";
import { PageHead } from "@/components/PageHead";
import { TeamStats } from "@/components/team/TeamStats";
import { MemberList } from "@/components/team/MemberList";
import { MemberDetail } from "@/components/team/MemberDetail";

export const dynamic = "force-dynamic";

export default async function TeamMemberPage({
  params,
}: PageProps<"/team/[id]">) {
  await requireApproved();
  const { id } = await params;
  const members = await getTeamMemberStats();

  return (
    <>
      <PageHead
        title="Cloud Team"
        desc="Every approved Cloud member and the status of their visits."
      />
      <TeamStats members={members} />
      <div className="two-col">
        <div className="card">
          <div className="section-label">All members</div>
          <MemberList members={members} activeId={id} />
        </div>
        <div className="card">
          <MemberDetail id={id} />
        </div>
      </div>
    </>
  );
}
