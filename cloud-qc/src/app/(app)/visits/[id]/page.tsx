import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { requireApproved } from "@/lib/authz";
import {
  getVisitWithHistory,
  memberName,
  resolveVisitBackTarget,
} from "@/lib/queries";
import { isoDate, statusMeta } from "@/lib/format";
import { type VisitSnapshot } from "@/lib/visit-history";
import { EVENT_TYPE_LABEL } from "@/lib/visit-schema";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import { VisitActions } from "@/components/visits/VisitActions";
import {
  VisitHistoryTimeline,
  type TimelineEntry,
} from "@/components/visits/VisitHistoryTimeline";

export const dynamic = "force-dynamic";

function rating(n: number | null) {
  return n == null ? "—" : `${n}/5`;
}

export default async function VisitDetailPage({
  params,
  searchParams,
}: PageProps<"/visits/[id]">) {
  const user = await requireApproved();
  const { id } = await params;
  const { from } = await searchParams;

  const visit = await getVisitWithHistory(id);
  if (!visit) notFound();

  const jointWith = visit.jointEventId
    ? await db.visit.findMany({
        where: {
          jointEventId: visit.jointEventId,
          id: { not: visit.id },
          deletedAt: null,
        },
        select: { id: true, neighbornet: { select: { id: true, name: true } } },
        orderBy: { neighbornet: { name: "asc" } },
      })
    : [];

  const back = await resolveVisitBackTarget(
    typeof from === "string" ? from : undefined,
  );

  const canModify =
    visit.submittedById === user.id || user.role === "ADMIN";
  const deleted = visit.deletedAt != null;
  const meta = statusMeta(visit.status);
  const coVisitors = visit.participants
    .filter((p) => p.role === "CO_VISITOR")
    .map((p) => memberName(p.user));

  const timeline: TimelineEntry[] = visit.history.map((h) => ({
    id: h.id,
    action: h.action,
    performedAt: h.performedAt,
    performedByName: memberName(h.performedBy),
    snapshot: h.snapshot as unknown as VisitSnapshot,
  }));

  return (
    <>
      <BackLink href={back.href} label={back.label} />
      <PageHead
        title="Visit"
        desc={
          <>
            <Link href={`/neighbornets/${visit.neighbornet.id}`}>
              {visit.neighbornet.name}
            </Link>{" "}
            · {isoDate(visit.visitDate)}
          </>
        }
      />

      {deleted && (
        <div
          className="auth-msg error"
          style={{ maxWidth: 640, marginBottom: 16 }}
        >
          This visit is deleted — it&apos;s excluded from all totals and views.
          {visit.deletedAt ? ` Deleted ${isoDate(visit.deletedAt)}.` : ""}
        </div>
      )}

      <div className="card" style={{ maxWidth: 640, marginBottom: 20 }}>
        <div className="section-label">
          <span>
            {visit.neighbornet.name}
            {visit.neighbornet.subArea ? ` — ${visit.neighbornet.subArea}` : ""}
          </span>
          {visit.status && (
            <span className={`badge ${meta.cls}`}>{meta.label}</span>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            gap: "4px 14px",
            fontSize: 13,
          }}
        >
          <div style={{ color: "var(--text-muted)" }}>Type</div>
          <div>{EVENT_TYPE_LABEL[visit.eventType]}</div>
          {jointWith.length > 0 && (
            <>
              <div style={{ color: "var(--text-muted)" }}>Joint event with</div>
              <div>
                {jointWith.map((j, i) => (
                  <span key={j.id}>
                    {i > 0 && ", "}
                    <Link href={`/visits/${j.id}`}>{j.neighbornet.name}</Link>
                  </span>
                ))}
              </div>
            </>
          )}
          <div style={{ color: "var(--text-muted)" }}>Visit date</div>
          <div className="cell-mono">{isoDate(visit.visitDate)}</div>
          <div style={{ color: "var(--text-muted)" }}>Submitted by</div>
          <div>{memberName(visit.submittedBy)}</div>
          <div style={{ color: "var(--text-muted)" }}>Co-visitors</div>
          <div>{coVisitors.length ? coVisitors.join(", ") : "—"}</div>
          <div style={{ color: "var(--text-muted)" }}>Group size</div>
          <div>{visit.groupSize ?? "—"}</div>
          <div style={{ color: "var(--text-muted)" }}>Average age</div>
          <div>{visit.avgAge ?? "—"}</div>
          <div style={{ color: "var(--text-muted)" }}>Food</div>
          <div>{rating(visit.foodRating)}</div>
          <div style={{ color: "var(--text-muted)" }}>Leadership</div>
          <div>{rating(visit.leadershipRating)}</div>
          <div style={{ color: "var(--text-muted)" }}>Halaqah</div>
          <div>{rating(visit.halaqahRating)}</div>
          <div style={{ color: "var(--text-muted)" }}>Feedback sent</div>
          <div>{visit.feedbackSent ? "Yes" : "No"}</div>
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
          {visit.notes}
          {visit.comments.map((c) => (
            <div
              key={c.id}
              style={{ marginTop: 6, color: "var(--text-muted)" }}
            >
              — {memberName(c.author)}: {c.body}
            </div>
          ))}
        </div>

        <VisitActions
          visitId={visit.id}
          deleted={deleted}
          canModify={canModify}
        />
      </div>

      <div className="card" style={{ maxWidth: 640 }}>
        <div className="section-label">History</div>
        <VisitHistoryTimeline entries={timeline} />
      </div>
    </>
  );
}
