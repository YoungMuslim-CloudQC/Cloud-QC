import Link from "next/link";

import { requireAdmin } from "@/lib/authz";
import { getDeletedVisits, memberName } from "@/lib/queries";
import { isoDate } from "@/lib/format";
import { type VisitSnapshot } from "@/lib/visit-history";
import { PageHead } from "@/components/PageHead";
import { VisitActions } from "@/components/visits/VisitActions";
import {
  VisitHistoryTimeline,
  type TimelineEntry,
} from "@/components/visits/VisitHistoryTimeline";

export const dynamic = "force-dynamic";

export default async function DeletedVisitsPage() {
  await requireAdmin();
  const visits = await getDeletedVisits();

  return (
    <>
      <PageHead
        title="Deleted visits"
        desc="Soft-deleted visits. They are excluded from every total and view until restored."
      />

      {visits.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <strong>Nothing deleted</strong>
            Deleted visits show up here with their full history.
          </div>
        </div>
      ) : (
        visits.map((v) => {
          const timeline: TimelineEntry[] = v.history.map((h) => ({
            id: h.id,
            action: h.action,
            performedAt: h.performedAt,
            performedByName: memberName(h.performedBy),
            snapshot: h.snapshot as unknown as VisitSnapshot,
          }));
          return (
            <div className="card" key={v.id} style={{ marginBottom: 16 }}>
              <div className="section-label">
                <span>
                  <Link href={`/visits/${v.id}?from=deleted`}>
                    {v.neighbornets.map((l) => l.neighbornet.name).join(", ") ||
                      v.subRegion ||
                      "Sub-region event"}
                  </Link>{" "}
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 400,
                      fontSize: 12,
                    }}
                  >
                    · {isoDate(v.visitDate)} · by {memberName(v.submittedBy)}
                  </span>
                </span>
                <span className="badge badge-urgent">
                  deleted {v.deletedAt ? isoDate(v.deletedAt) : ""}
                </span>
              </div>

              <VisitHistoryTimeline entries={timeline} />

              <VisitActions visitId={v.id} deleted canModify />
            </div>
          );
        })
      )}
    </>
  );
}
