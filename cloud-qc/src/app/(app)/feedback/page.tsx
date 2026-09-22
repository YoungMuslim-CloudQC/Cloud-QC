import Link from "next/link";

import { db } from "@/lib/db";
import { requireApproved } from "@/lib/authz";
import { memberName, getRegionMap } from "@/lib/queries";
import { isoDate, statusMeta } from "@/lib/format";
import {
  EMPTY_VISIT_INPUT,
  EVENT_TYPE_LABEL,
  type VisitInput,
} from "@/lib/visit-schema";
import { PageHead } from "@/components/PageHead";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { SubmissionRowActions } from "@/components/feedback/SubmissionRowActions";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  searchParams,
}: PageProps<"/feedback">) {
  const user = await requireApproved();
  const { edit } = await searchParams;
  const editId = typeof edit === "string" ? edit : null;

  const [neighbornets, members, mySubmissions, editingVisit, regionMap, me] =
    await Promise.all([
      db.neighbornet.findMany({
        where: { archivedAt: null },
        orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
        select: { id: true, name: true, subArea: true, region: true },
      }),
      db.user.findMany({
        where: { status: "APPROVED", id: { not: user.id } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      }),
      db.visit.findMany({
        where: { submittedById: user.id, deletedAt: null },
        orderBy: { visitDate: "desc" },
        include: { neighbornets: { include: { neighbornet: { select: { name: true } } } } },
      }),
      editId
        ? db.visit.findUnique({
            where: { id: editId },
            include: { participants: true, neighbornets: true },
          })
        : Promise.resolve(null),
      getRegionMap(),
      db.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { homeSubArea: true },
      }),
    ]);

  const canEditVisit =
    editingVisit != null &&
    editingVisit.deletedAt == null &&
    (editingVisit.submittedById === user.id || user.role === "ADMIN");

  let editing: { visitId: string; input: VisitInput } | null = null;
  if (editingVisit && canEditVisit) {
    editing = {
      visitId: editingVisit.id,
      input: {
        ...EMPTY_VISIT_INPUT,
        neighbornetIds: editingVisit.neighbornets.map((l) => l.neighbornetId),
        eventType: editingVisit.eventType,
        subRegion: editingVisit.subRegion ?? undefined,
        visitDate: isoDate(editingVisit.visitDate),
        groupSize: editingVisit.groupSize,
        avgAge: editingVisit.avgAge,
        foodRating: editingVisit.foodRating,
        leadershipRating: editingVisit.leadershipRating,
        halaqahRating: editingVisit.halaqahRating,
        status: editingVisit.status,
        notes: editingVisit.notes,
        coVisitorIds: editingVisit.participants
          .filter((p) => p.role === "CO_VISITOR")
          .map((p) => p.userId),
      },
    };
  }

  return (
    <>
      <PageHead
        title="Submit QC Feedback"
        desc="Log notes from a neighbornet visit."
      />

      <FeedbackForm
        key={editing?.visitId ?? "new"}
        neighbornets={neighbornets.map((n) => ({
          id: n.id,
          name: n.name,
          subArea: n.subArea,
          region: n.region,
          label: n.subArea ? `${n.name} — ${n.subArea}` : n.name,
        }))}
        regionMap={regionMap}
        homeSubArea={me.homeSubArea}
        members={members.map((m) => ({ id: m.id, label: memberName(m) }))}
        submitterName={memberName(user)}
        editing={editing}
      />

      <div className="card" style={{ maxWidth: 640, marginTop: 20 }}>
        <div className="section-label">Your submission history</div>
        {mySubmissions.length === 0 ? (
          <div className="empty-state">
            <strong>Nothing yet</strong>
            Submissions you make will show up here for editing.
          </div>
        ) : (
          mySubmissions.map((v) => {
            const meta = statusMeta(v.status);
            return (
              <div
                className="visit-row"
                key={v.id}
                style={{ gridTemplateColumns: "90px 1fr auto" }}
              >
                <div className="visit-date">
                  <Link href={`/visits/${v.id}`}>{isoDate(v.visitDate)}</Link>
                </div>
                <div>
                  <div className="visit-nn">
                    {v.neighbornets.map((l) => l.neighbornet.name).join(", ") ||
                      v.subRegion ||
                      "Sub-region event"}
                  </div>
                  <span className={`badge ${meta.cls}`}>{meta.label}</span>
                  {v.eventType !== "VISIT" && (
                    <span className="badge badge-event" style={{ marginLeft: 6 }}>
                      {EVENT_TYPE_LABEL[v.eventType]}
                    </span>
                  )}
                </div>
                <SubmissionRowActions visitId={v.id} />
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
