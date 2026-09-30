import { cookies } from "next/headers";

import { db } from "@/lib/db";
import { requireAdmin, VIEW_AS_COOKIE } from "@/lib/authz";
import { memberName } from "@/lib/queries";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import { Avatar } from "@/components/Avatar";
import { startViewAs } from "@/server/actions/view-as";

export const dynamic = "force-dynamic";

const ROLE_LABEL = {
  SR_COORDINATOR: "SR coordinator",
  COORDINATOR: "Coordinator",
  CORE_TEAM: "Core team",
  CLOUD_LEAD: "Cloud Lead",
} as const;

/** Pick someone to see the app as. Admin-only, and strictly a look: every
 *  server action refuses while a view-as is in effect, so nothing an admin
 *  does here can land on the account they're borrowing. */
export default async function ViewAsPage({
  searchParams,
}: PageProps<"/admin/view-as">) {
  await requireAdmin();
  const { error } = await searchParams;
  const active = (await cookies()).get(VIEW_AS_COOKIE)?.value ?? null;

  const seats = await db.userRoleAssignment.findMany({
    orderBy: [{ roleType: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      roleType: true,
      scopeSubregion: true,
      scopeNeighbornet: { select: { name: true } },
      inheritsFrom: { select: { name: true, email: true } },
      user: {
        select: { id: true, name: true, email: true, image: true, status: true },
      },
    },
  });

  // One row per person, listing everything they hold — an admin picks a
  // person, not a seat.
  const byUser = new Map<
    string,
    {
      user: (typeof seats)[number]["user"];
      lines: string[];
    }
  >();
  for (const s of seats) {
    const entry = byUser.get(s.user.id) ?? { user: s.user, lines: [] };
    const what =
      s.roleType === "COORDINATOR"
        ? (s.scopeNeighbornet?.name ?? "—")
        : s.roleType === "SR_COORDINATOR"
          ? (s.scopeSubregion ?? "—")
          : `under ${s.inheritsFrom?.name ?? s.inheritsFrom?.email ?? "someone"}`;
    entry.lines.push(`${ROLE_LABEL[s.roleType]} · ${what}`);
    byUser.set(s.user.id, entry);
  }
  const people = [...byUser.values()].filter((p) => p.user.status === "APPROVED");

  return (
    <>
      <BackLink href="/admin" label="Admin" />
      <PageHead
        title="View as"
        desc="See the app exactly as a coordinator or SR coordinator sees it."
      />

      {error === "self" && (
        <div className="auth-msg error">That&rsquo;s your own account.</div>
      )}
      {error === "missing" && (
        <div className="auth-msg error">
          That account isn&rsquo;t available to view as.
        </div>
      )}

      <div className="card" style={{ maxWidth: 720, marginBottom: 16 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
          You&rsquo;ll get their navigation, their neighbornets and their
          unread counts — the same screens they log in to. It&rsquo;s
          read-only: while you&rsquo;re viewing as someone, every action is
          refused, so you can&rsquo;t mark their feedback read or change their
          team by accident. It ends after an hour, or whenever you stop.
        </p>
      </div>

      {people.length === 0 ? (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="empty-state">
            <strong>Nobody to view as yet</strong>
            Once an account holds a coordinator, SR coordinator or core team
            seat, it shows up here.
          </div>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="section-label">
            <span>Coordinator-side accounts</span>
            <span className="survey-time-note">{people.length}</span>
          </div>
          {people.map(({ user: u, lines }) => (
            <div className="user-row" key={u.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={memberName(u)} image={u.image} />
                <div>
                  <strong>{memberName(u)}</strong>
                  <div style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
                    {u.email}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {lines.map((l) => (
                  <div key={l}>{l}</div>
                ))}
              </div>
              <div />
              <form action={startViewAs}>
                <input type="hidden" name="userId" value={u.id} />
                <button
                  className="btn btn-small btn-secondary"
                  type="submit"
                  disabled={active === u.id}
                >
                  {active === u.id ? "Viewing" : "View as"}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
