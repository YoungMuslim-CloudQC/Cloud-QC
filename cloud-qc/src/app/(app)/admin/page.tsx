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
    coordinates: {
      select: {
        neighbornet: { select: { id: true, name: true, subArea: true } },
      },
    },
  } as const;
  const [pending, all, settings, neighbornets, regionMap, newSiteFeedback] =
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
    ]);

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
                {u.role === "COORDINATOR" ? (
                  <>
                    <span className="badge badge-event">coordinator</span>
                    <div style={{ marginTop: 4 }}>
                      Says they coordinate:{" "}
                      {u.coordinates.length
                        ? u.coordinates.map((c) => c.neighbornet.name).join(", ")
                        : "—"}
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
            {u.role === "COORDINATOR" && u.status === "APPROVED" && (
              <CoordinatorAssign
                userId={u.id}
                initialIds={u.coordinates.map((c) => c.neighbornet.id)}
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
