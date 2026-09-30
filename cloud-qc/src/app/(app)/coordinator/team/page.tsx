import { db } from "@/lib/db";
import { requireViewRole } from "@/lib/authz";
import { memberName } from "@/lib/queries";
import { isoDate } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import { CoreTeamManager } from "@/components/coordinator/CoreTeamManager";

export const dynamic = "force-dynamic";

/** Who this coordinator has put on their core team. A core-team seat grants
 *  exactly what the person who granted it can see — no more — so this page
 *  is also the honest answer to "who can read my neighbornet's feedback?". */
export default async function CoreTeamPage() {
  const user = await requireViewRole();

  const seats = await db.userRoleAssignment.findMany({
    where: { roleType: "CORE_TEAM", inheritsFromUserId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  });

  return (
    <>
      <BackLink href="/coordinator" label="Your neighbornet" />
      <PageHead
        title="Your core team"
        desc="People you've given the same view of your neighbornet's feedback."
      />

      <div className="card" style={{ maxWidth: 680, marginBottom: 16 }}>
        <div className="section-label">
          <span>On your team</span>
          <span className="survey-time-note">
            {seats.length} {seats.length === 1 ? "person" : "people"}
          </span>
        </div>

        {seats.length === 0 ? (
          <div className="empty-state">
            <strong>Nobody yet</strong>
            Add someone below and they&rsquo;ll see exactly what you see — the
            same feedback, the same neighbornet, nothing more.
          </div>
        ) : (
          seats.map((s) => (
            <div className="user-row" key={s.id}>
              <div>
                <strong>{memberName(s.user)}</strong>
                <div style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
                  {s.user.email}
                </div>
              </div>
              <div>
                {s.user.status === "APPROVED" ? (
                  <span className="badge badge-success">Active</span>
                ) : (
                  <span className="badge badge-warn">Awaiting admin</span>
                )}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                added {isoDate(s.createdAt)}
              </div>
              <CoreTeamManager mode="remove" userId={s.user.id} name={memberName(s.user)} />
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        <div className="section-label">Add someone</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
          Invite by email. They&rsquo;ll sign up with that address, and an admin
          approves them before they can see anything. Someone already on the
          Cloud QC team can&rsquo;t be added here — it would stop them logging
          visits, so an admin sets that up instead.
        </p>
        {user.impersonating ? (
          <div className="survey-time-note">Read-only while viewing as someone else.</div>
        ) : (
          <CoreTeamManager mode="add" />
        )}
      </div>
    </>
  );
}
