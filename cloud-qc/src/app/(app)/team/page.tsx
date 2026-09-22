import { requireApproved } from "@/lib/authz";
import { getTeamMemberStats } from "@/lib/queries";
import { PageHead } from "@/components/PageHead";
import { TeamStats } from "@/components/team/TeamStats";
import { MemberList } from "@/components/team/MemberList";
import { Leaderboard } from "@/components/team/Leaderboard";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await requireApproved();
  const members = await getTeamMemberStats();

  return (
    <>
      <PageHead
        title="Cloud Team"
        desc="Every approved Cloud member and the status of their visits."
      />
      <TeamStats members={members} />

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-label">
          Leaderboard
          <span style={{ fontWeight: 400, fontSize: 11.5, color: "var(--text-muted)" }}>
            Ranked by points — one per visit logged, joint events included once
          </span>
        </div>
        <Leaderboard members={members} />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="section-label">All members</div>
          <MemberList members={members} />
        </div>
        <div className="card">
          <div className="empty-state">
            <strong>No member selected</strong>
            Pick someone from the list to see their visit history.
          </div>
        </div>
      </div>
    </>
  );
}
