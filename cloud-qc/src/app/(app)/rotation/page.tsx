import { requireApproved } from "@/lib/authz";
import { db } from "@/lib/db";
import { memberName } from "@/lib/queries";
import { isoDate } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import {
  assignRotation,
  joinRotation,
  leaveRotation,
  unassignRotation,
} from "@/server/actions/rotation";

export const dynamic = "force-dynamic";

export default async function RotationPage() {
  const user = await requireApproved();
  const isAdmin = user.role === "ADMIN";

  const [neighbornets, members, history] = await Promise.all([
    db.neighbornet.findMany({
      where: { archivedAt: null },
      orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
      include: {
        rotations: {
          where: { endedOn: null },
          orderBy: { startedOn: "asc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
    db.user.findMany({
      where: { status: "APPROVED", role: { not: "COORDINATOR" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
    db.rotationAssignment.findMany({
      orderBy: { startedOn: "desc" },
      take: 12,
      include: {
        user: { select: { name: true, email: true } },
        neighbornet: { select: { name: true } },
      },
    }),
  ]);

  return (
    <>
      <PageHead
        title="Rotation"
        desc="Which Cloud/QC members are currently paired with each neighbornet. You can join or leave a pairing for yourself; admins can assign anyone."
      />

      <div className="card">
        {neighbornets.length === 0 ? (
          <div className="empty-state">
            <strong>No neighbornets yet</strong>
            Add neighbornets first, then assign partners here.
          </div>
        ) : (
          neighbornets.map((n) => {
            const memberIds = new Set(n.rotations.map((r) => r.user.id));
            const iAmIn = memberIds.has(user.id);
            const since = n.rotations[0]
              ? `since ${isoDate(n.rotations[0].startedOn)}`
              : "unassigned";
            const available = members.filter((m) => !memberIds.has(m.id));

            return (
              <div className="card" key={n.id} style={{ marginBottom: 12 }}>
                <div className="section-label">
                  <span>
                    {n.name}
                    <span
                      style={{
                        color: "var(--text-muted)",
                        fontWeight: 400,
                        fontSize: 12,
                      }}
                    >
                      {" "}
                      — {n.subArea}
                    </span>
                  </span>
                  <span className="badge badge-neutral">{since}</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  {n.rotations.length === 0 ? (
                    <span
                      style={{ color: "var(--text-muted)", fontSize: 12.5 }}
                    >
                      No one paired yet
                    </span>
                  ) : (
                    n.rotations.map((r) => {
                      const canRemove = isAdmin || r.user.id === user.id;
                      return (
                        <span className="chip" key={r.id}>
                          {memberName(r.user)}
                          {canRemove && (
                            <form action={unassignRotation}>
                              <input
                                type="hidden"
                                name="neighbornetId"
                                value={n.id}
                              />
                              <input
                                type="hidden"
                                name="userId"
                                value={r.user.id}
                              />
                              <button className="chip-remove" type="submit">
                                ×
                              </button>
                            </form>
                          )}
                        </span>
                      );
                    })
                  )}
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  {isAdmin ? (
                    <form
                      action={assignRotation}
                      style={{ display: "flex", gap: 8, flex: 1 }}
                    >
                      <input type="hidden" name="neighbornetId" value={n.id} />
                      <select name="userId" required defaultValue="">
                        <option value="" disabled>
                          Add a Cloud member…
                        </option>
                        {available.map((m) => (
                          <option key={m.id} value={m.id}>
                            {memberName(m)}
                          </option>
                        ))}
                      </select>
                      <button
                        className="btn btn-secondary btn-small"
                        type="submit"
                        style={{ flexShrink: 0 }}
                      >
                        Add
                      </button>
                    </form>
                  ) : iAmIn ? (
                    <form action={leaveRotation}>
                      <input type="hidden" name="neighbornetId" value={n.id} />
                      <button
                        className="btn btn-secondary btn-small"
                        type="submit"
                      >
                        Leave this pairing
                      </button>
                    </form>
                  ) : (
                    <form action={joinRotation}>
                      <input type="hidden" name="neighbornetId" value={n.id} />
                      <button
                        className="btn btn-primary btn-small"
                        type="submit"
                        style={{ width: "auto" }}
                      >
                        Join this pairing
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="section-label">Assignment history</div>
        {history.length === 0 ? (
          <div className="empty-state">
            <strong>No assignments yet</strong>
            Pair someone above to start a history.
          </div>
        ) : (
          history.map((h) => (
            <div
              className="visit-row"
              key={h.id}
              style={{ gridTemplateColumns: "90px 1fr 1fr" }}
            >
              <div className="visit-date">{isoDate(h.startedOn)}</div>
              <div className="visit-nn">{h.neighbornet.name}</div>
              <div>
                {memberName(h.user)}
                {h.endedOn ? (
                  <span style={{ color: "var(--text-muted)" }}>
                    {" "}
                    · ended {isoDate(h.endedOn)}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
