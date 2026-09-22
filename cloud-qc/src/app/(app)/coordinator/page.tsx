import Link from "next/link";

import { db } from "@/lib/db";
import { requireCoordinator } from "@/lib/authz";
import { memberName } from "@/lib/queries";
import { isoDate, statusMeta } from "@/lib/format";
import { EVENT_TYPE_LABEL } from "@/lib/visit-schema";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

const INBOX_LIMIT = 100;

function rating(n: number | null) {
  return n == null ? "—" : `${n}/5`;
}

/** Read-only inbox of everything QC members have logged about the
 *  neighbornet(s) this coordinator runs. */
export default async function CoordinatorInboxPage({
  searchParams,
}: PageProps<"/coordinator">) {
  const user = await requireCoordinator();
  const { nn: nnParam } = await searchParams;

  const assignments = await db.neighbornetCoordinator.findMany({
    where: { userId: user.id, neighbornet: { archivedAt: null } },
    orderBy: { neighbornet: { name: "asc" } },
    select: { neighbornet: { select: { id: true, name: true, subArea: true } } },
  });
  const myNns = assignments.map((a) => a.neighbornet);

  if (myNns.length === 0) {
    return (
      <>
        <PageHead title="Feedback inbox" desc="Feedback about your neighbornet." />
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="empty-state">
            <strong>No neighbornet linked yet</strong>
            An admin needs to link your account to the neighbornet you
            coordinate before feedback shows up here.
          </div>
        </div>
      </>
    );
  }

  const selected =
    typeof nnParam === "string" && myNns.some((n) => n.id === nnParam)
      ? nnParam
      : "";

  const visits = await db.visit.findMany({
    where: {
      deletedAt: null,
      // The credit-bearing link — a joint event touching this coordinator's
      // NN still shows up here; a Bash/SR event never has one, so it can't.
      neighbornets: {
        some: { neighbornetId: selected ? selected : { in: myNns.map((n) => n.id) } },
      },
    },
    orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    take: INBOX_LIMIT,
    include: {
      neighbornets: { include: { neighbornet: { select: { id: true, name: true } } } },
      submittedBy: { select: { name: true, email: true } },
      participants: {
        where: { role: "CO_VISITOR" },
        include: { user: { select: { name: true, email: true } } },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  return (
    <>
      <PageHead
        title="Feedback inbox"
        desc={
          myNns.length === 1
            ? `Everything QC has logged about ${myNns[0].name}.`
            : "Everything QC has logged about your neighbornets."
        }
      />

      {myNns.length > 1 && (
        <div className="status-options" style={{ marginBottom: 16, maxWidth: 640 }}>
          <Link
            href="/coordinator"
            className={`status-opt${selected === "" ? " sel-ok" : ""}`}
            style={{ textDecoration: "none" }}
          >
            All
          </Link>
          {myNns.map((n) => (
            <Link
              key={n.id}
              href={`/coordinator?nn=${n.id}`}
              className={`status-opt${selected === n.id ? " sel-ok" : ""}`}
              style={{ textDecoration: "none" }}
            >
              {n.name}
            </Link>
          ))}
        </div>
      )}

      {visits.length === 0 ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="empty-state">
            <strong>No feedback yet</strong>
            When a QC member logs a visit to your neighbornet, it will show up
            here.
          </div>
        </div>
      ) : (
        visits.map((v) => {
          const meta = statusMeta(v.status);
          const coVisitors = v.participants.map((p) => memberName(p.user));
          const by = coVisitors.length
            ? `${memberName(v.submittedBy)} + ${coVisitors.join(", ")}`
            : memberName(v.submittedBy);
          return (
            <div className="card" key={v.id} style={{ maxWidth: 640, marginBottom: 14 }}>
              <div className="section-label">
                <span>
                  {v.neighbornets.map((l) => l.neighbornet.name).join(", ")} &middot;{" "}
                  {isoDate(v.visitDate)}
                </span>
                <span style={{ display: "flex", gap: 6 }}>
                  {v.eventType !== "VISIT" && (
                    <span className="badge badge-event">
                      {EVENT_TYPE_LABEL[v.eventType]}
                    </span>
                  )}
                  {v.status && <span className={`badge ${meta.cls}`}>{meta.label}</span>}
                </span>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  gap: "4px 14px",
                  fontSize: 13,
                }}
              >
                <div style={{ color: "var(--text-muted)" }}>Visited by</div>
                <div>{by}</div>
                <div style={{ color: "var(--text-muted)" }}>Group size</div>
                <div>{v.groupSize ?? "—"}</div>
                <div style={{ color: "var(--text-muted)" }}>Average age</div>
                <div>{v.avgAge ?? "—"}</div>
                <div style={{ color: "var(--text-muted)" }}>Food</div>
                <div>{rating(v.foodRating)}</div>
                <div style={{ color: "var(--text-muted)" }}>Leadership</div>
                <div>{rating(v.leadershipRating)}</div>
                <div style={{ color: "var(--text-muted)" }}>Halaqah</div>
                <div>{rating(v.halaqahRating)}</div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  whiteSpace: "pre-wrap",
                  fontSize: 13,
                  borderLeft: "2px solid var(--border)",
                  paddingLeft: 10,
                }}
              >
                {v.notes}
                {v.comments.map((c) => (
                  <div key={c.id} style={{ marginTop: 6, color: "var(--text-muted)" }}>
                    — {memberName(c.author)}: {c.body}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
      {visits.length === INBOX_LIMIT && (
        <div className="survey-time-note">Showing the latest {INBOX_LIMIT}.</div>
      )}
    </>
  );
}
