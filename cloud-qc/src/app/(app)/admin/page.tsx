import Link from "next/link";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { getSettings, getRegionMap } from "@/lib/queries";
import { PageHead } from "@/components/PageHead";
import { approveUser, rejectUser, setUserRole } from "@/server/actions/admin";
import { DashboardAdjustments } from "@/components/admin/DashboardAdjustments";
import { CoordinatorAssign } from "@/components/admin/CoordinatorAssign";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await requireAdmin();

  const withNns = {
    roleAssignments: {
      select: {
        id: true,
        roleType: true,
        scopeSubregion: true,
        transitionEndsAt: true,
        scopeNeighbornet: { select: { id: true, name: true, subArea: true } },
        inheritsFrom: { select: { id: true, name: true, email: true } },
      },
    },
  } as const;
  const [pending, all, settings, neighbornets, regionMap, newSiteFeedback, pendingDisputes] =
    await Promise.all([
      db.user.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        include: withNns,
      }),
      db.user.findMany({
        orderBy: [{ status: "asc" }, { name: "asc" }],
        include: withNns,
      }),
      getSettings(),
      db.neighbornet.findMany({
        where: { archivedAt: null },
        orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
        select: { id: true, name: true, subArea: true, region: true },
      }),
      getRegionMap(),

      db.siteFeedback.count({ where: { status: "NEW" } }),
      db.visitDispute.count({ where: { status: "PENDING" } }),
    ]);

  // Resolve the neighbornets people claimed at signup, so the approval
  // review can show "claims they coordinate Teaneck" rather than an id.
  const requestedIds = [...pending, ...all]
    .map((u) => u.requestedNeighbornetId)
    .filter((id): id is string => Boolean(id));
  const requestedNnName = new Map(
    requestedIds.length
      ? (
          await db.neighbornet.findMany({
            where: { id: { in: requestedIds } },
            select: { id: true, name: true },
          })
        ).map((n) => [n.id, n.name] as const)
      : [],
  );
  const claimNameByUser = new Map(
    [...pending, ...all]
      .filter((u) => u.requestedNeighbornetId)
      .map((u) => [u.id, requestedNnName.get(u.requestedNeighbornetId!) ?? null] as const),
  );

  return (
    <>
      <PageHead
        title="Admin"
        desc="Approve accounts, manage roles, and adjust dashboard numbers."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Dashboard adjustments</div>
        <DashboardAdjustments
          manualOffset={settings.manualOffset}
          goal={settings.goal}
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Site feedback</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Comments members leave on any page with the &ldquo;Improve this page&rdquo;
          button, including the part of the screen they highlighted.
        </p>
        <Link className="btn btn-secondary btn-small" href="/admin/site-feedback">
          Open site feedback{newSiteFeedback > 0 ? ` (${newSiteFeedback} new)` : ""}
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Meets under review</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Someone said they weren&rsquo;t at a visit another member logged them on.
          Review both sides and correct the record.
        </p>
        <Link className="btn btn-secondary btn-small" href="/admin/visit-disputes">
          Open meets under review{pendingDisputes > 0 ? ` (${pendingDisputes} pending)` : ""}
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">View as</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>
          See the app exactly as a coordinator or SR coordinator sees it —
          their navigation, their neighbornets, their unread counts.
          Read-only: every action is blocked while you&rsquo;re in it.
        </p>
        <Link className="btn btn-secondary btn-small" href="/admin/view-as">
          Pick someone to view as
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Archives</div>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 10px" }}>
          Deleted visits keep their full history and can be restored. Archived
          neighbornets are hidden from active use but keep all their past data.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            className="btn btn-secondary btn-small"
            href="/admin/deleted-visits"
          >
            Deleted visits
          </Link>
          <Link
            className="btn btn-secondary btn-small"
            href="/admin/archived-neighbornets"
          >
            Archived neighbornets
          </Link>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="section-label">Pending approval</div>
        {pending.length === 0 ? (
          <div className="empty-state">
            <strong>Nothing pending</strong>
            New sign-ups will show up here.
          </div>
        ) : (
          pending.map((u) => (
            <div key={u.id} className="user-row">
              <div>
                <strong>{u.name || "—"}</strong>
                <div style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
                  {u.email}
                </div>
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {u.requestedRole === "COORDINATOR" ? (
                  <>
                    <span className="badge badge-event">wants coordinator</span>
                    <div style={{ marginTop: 4 }}>
                      Claims they coordinate:{" "}
                      {claimNameByUser.get(u.id) ?? "— (didn't say)"}
                    </div>
                    <div style={{ marginTop: 2 }}>
                      Approving them creates the seat — confirm or change the
                      neighbornet below.
                    </div>
                  </>
                ) : u.passwordHash ? (
                  "Email / password"
                ) : (
                  "Google"
                )}
              </div>
              <div />
              <div style={{ display: "flex", gap: 6 }}>
                <form action={approveUser}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button className="btn btn-small btn-approve" type="submit">
                    Approve
                  </button>
                </form>
                <form action={rejectUser}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button className="btn btn-small btn-reject" type="submit">
                    Reject
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <div className="section-label">All accounts</div>
        {all.map((u) => {
          return (
            <div key={u.id}>
            <div className="user-row">
              <div>
                <strong>{u.name || "—"}</strong>
                <div style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>
                  {u.email}
                </div>
              </div>
              <div>
                <span
                  className={`badge ${
                    u.status === "APPROVED"
                      ? "badge-success"
                      : u.status === "PENDING"
                        ? "badge-warn"
                        : "badge-urgent"
                  }`}
                >
                  {u.status.toLowerCase()}
                </span>
              </div>
              <div>
                <span className="badge badge-neutral">
                  {u.role.toLowerCase()}
                </span>
              </div>
              <div>
                {u.status === "APPROVED" && u.id !== me.id && (
                  <form action={setUserRole} className="role-form">
                    <input type="hidden" name="userId" value={u.id} />
                    <select name="role" defaultValue={u.role} aria-label="Role">
                      <option value="MEMBER">QC member</option>
                      <option value="COORDINATOR">Coordinator</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <button
                      className="btn btn-secondary btn-small"
                      type="submit"
                    >
                      Set role
                    </button>
                  </form>
                )}
              </div>
            </div>
            {u.status === "APPROVED" && u.role !== "ADMIN" && (
              <CoordinatorAssign
                userId={u.id}
                initialId={
                  u.roleAssignments.find((a) => a.roleType === "COORDINATOR")
                    ?.scopeNeighbornet?.id ??
                  (u.requestedRole === "COORDINATOR"
                    ? (u.requestedNeighbornetId ?? null)
                    : null)
                }
                initialSubregion={
                  u.roleAssignments.find((a) => a.roleType === "SR_COORDINATOR")
                    ?.scopeSubregion ?? null
                }
                neighbornets={neighbornets}
                regionMap={regionMap}
              />
            )}
            </div>
          );
        })}
      </div>
    </>
  );
}
