import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { PageHead } from "@/components/PageHead";
import { approveUser, rejectUser, setUserRole } from "@/server/actions/admin";

export default async function AdminPage() {
  const me = await requireAdmin();

  const [pending, all] = await Promise.all([
    db.user.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <>
      <PageHead
        title="Admin"
        desc="Approve accounts and manage roles."
      />

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
                {u.passwordHash ? "Email / password" : "Google"}
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
          const nextRole = u.role === "ADMIN" ? "MEMBER" : "ADMIN";
          return (
            <div key={u.id} className="user-row">
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
                  <form action={setUserRole}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="role" value={nextRole} />
                    <button
                      className="btn btn-secondary btn-small"
                      type="submit"
                    >
                      Make {nextRole.toLowerCase()}
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
