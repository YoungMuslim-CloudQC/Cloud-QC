import Link from "next/link";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { memberName } from "@/lib/queries";
import { isoDate } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import { DisputeActions } from "@/components/admin/DisputeActions";

export const dynamic = "force-dynamic";

function nnLabel(v: {
  neighbornets: { neighbornet: { name: string } }[];
  subRegion: string | null;
}) {
  return v.neighbornets.map((l) => l.neighbornet.name).join(", ") || v.subRegion || "—";
}

export default async function VisitDisputesPage({
  searchParams,
}: PageProps<"/admin/visit-disputes">) {
  await requireAdmin();
  const { status: statusParam } = await searchParams;
  const filter = statusParam === "RESOLVED" ? "RESOLVED" : statusParam === "ALL" ? "ALL" : "PENDING";

  const [disputes, pendingCount, resolvedCount] = await Promise.all([
    db.visitDispute.findMany({
      where: filter === "ALL" ? {} : { status: filter },
      orderBy: { createdAt: "desc" },
      include: {
        visit: {
          include: {
            submittedBy: { select: { name: true, email: true } },
            neighbornets: { include: { neighbornet: { select: { name: true } } } },
            participants: { include: { user: { select: { name: true, email: true } } } },
          },
        },
        ownVisit: {
          include: {
            neighbornets: { include: { neighbornet: { select: { name: true } } } },
          },
        },
        disputedUser: { select: { name: true, email: true } },
        resolvedBy: { select: { name: true, email: true } },
      },
    }),
    db.visitDispute.count({ where: { status: "PENDING" } }),
    db.visitDispute.count({ where: { status: "RESOLVED" } }),
  ]);

  const tab = (value: string, label: string, count?: number) => (
    <Link
      key={value}
      href={`/admin/visit-disputes?status=${value}`}
      className={`status-opt${filter === value ? " sel-ok" : ""}`}
      style={{ textDecoration: "none" }}
    >
      {label}
      {count != null ? ` (${count})` : ""}
    </Link>
  );

  return (
    <>
      <BackLink href="/admin" label="Admin" />
      <PageHead
        title="Meets under review"
        desc="Someone said they weren't at a visit another member logged them on — same neighbornet, same date, disagreement about who was there."
      />

      <div className="status-options" style={{ marginBottom: 16, maxWidth: 560 }}>
        {tab("PENDING", "Pending", pendingCount)}
        {tab("RESOLVED", "Resolved", resolvedCount)}
        {tab("ALL", "All", pendingCount + resolvedCount)}
      </div>

      {disputes.length === 0 ? (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="empty-state">
            <strong>Nothing here</strong>
            {filter === "PENDING"
              ? "No disputes right now — these show up when someone says “no, I wasn’t there” to a visit that named them."
              : "No disputes in this view."}
          </div>
        </div>
      ) : (
        disputes.map((d) => {
          const submitterName = memberName(d.visit.submittedBy);
          const disputedName = memberName(d.disputedUser);
          const stillListed = d.visit.participants.some((p) => p.userId === d.disputedUserId);
          return (
            <div className="card" key={d.id} style={{ maxWidth: 720, marginBottom: 16 }}>
              <div className="section-label">
                <span>
                  {submitterName} vs. {disputedName} &middot; {isoDate(d.createdAt)}
                </span>
                <span className={`badge ${d.status === "PENDING" ? "badge-warn" : "badge-success"}`}>
                  {d.status === "PENDING" ? "pending" : "resolved"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                <div>
                  <div className="sf-item-label">
                    {submitterName}&rsquo;s visit (<Link href={`/visits/${d.visit.id}`}>open</Link>)
                  </div>
                  <div>{nnLabel(d.visit)} &middot; {isoDate(d.visit.visitDate)}</div>
                  <div style={{ color: "var(--text-muted)" }}>
                    Participants: {d.visit.participants.map((p) => memberName(p.user)).join(", ")}
                    {stillListed ? "" : ` (${disputedName} already removed)`}
                  </div>
                </div>
                <div>
                  <div className="sf-item-label">{disputedName}&rsquo;s own visit</div>
                  {d.ownVisit ? (
                    <div>
                      <Link href={`/visits/${d.ownVisit.id}`}>{nnLabel(d.ownVisit)}</Link>
                      {" · "}
                      {isoDate(d.ownVisit.visitDate)}
                    </div>
                  ) : (
                    <div style={{ color: "var(--text-muted)" }}>Deleted or not created.</div>
                  )}
                </div>
              </div>

              {d.note && (
                <div className="sf-item-quote" style={{ marginTop: 10 }}>
                  Admin note: {d.note}
                </div>
              )}
              {d.resolvedBy && (
                <div className="survey-time-note" style={{ marginTop: 6 }}>
                  Resolved by {memberName(d.resolvedBy)}
                  {d.resolvedAt ? ` on ${isoDate(d.resolvedAt)}` : ""}.
                </div>
              )}
              {d.notifiedAt && (
                <div className="survey-time-note">
                  {submitterName} notified {isoDate(d.notifiedAt)}.
                </div>
              )}

              <DisputeActions
                disputeId={d.id}
                status={d.status}
                originalVisitId={d.visit.id}
                ownVisitId={d.ownVisit?.id ?? null}
                notified={d.notifiedAt != null}
              />
            </div>
          );
        })
      )}
    </>
  );
}
