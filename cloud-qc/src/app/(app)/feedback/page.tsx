import Link from "next/link";

import { db } from "@/lib/db";
import { requireApproved } from "@/lib/authz";
import { memberName } from "@/lib/queries";
import { isoDate, statusMeta } from "@/lib/format";
import { EMPTY_VISIT_INPUT, type VisitInput } from "@/lib/visit-schema";
import { PageHead } from "@/components/PageHead";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export const dynamic = "force-dynamic";

export default async function FeedbackPage({
  searchParams,
}: PageProps<"/feedback">) {
  const user = await requireApproved();
  const { edit } = await searchParams;
  const editId = typeof edit === "string" ? edit : null;

  const [neighbornets, members, mySubmissions, editingVisit] =
    await Promise.all([
      db.neighbornet.findMany({
        where: { archivedAt: null },
        orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
        select: { id: true, name: true, subArea: true },
      }),
      db.user.findMany({
        where: { status: "APPROVED", id: { not: user.id } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      }),
      db.visit.findMany({
        where: { submittedById: user.id, deletedAt: null },
        orderBy: { visitDate: "desc" },
        include: { neighbornet: { select: { name: true } } },
      }),
      editId
        ? db.visit.findUnique({
            where: { id: editId },
            include: { participants: true },
          })
        : Promise.resolve(null),
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
        neighbornetId: editingVisit.neighbornetId,
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
          label: n.subArea ? `${n.name} — ${n.subArea}` : n.name,
        }))}
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
                style={{ gridTemplateColumns: "90px 1fr 90px" }}
              >
                <div className="visit-date">
                  <Link href={`/visits/${v.id}`}>{isoDate(v.visitDate)}</Link>
                </div>
                <div>
                  <div className="visit-nn">{v.neighbornet.name}</div>
                  <span className={`badge ${meta.cls}`}>{meta.label}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Link
                    className="btn btn-secondary btn-small"
                    href={`/feedback?edit=${v.id}`}
                  >
                    Edit
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
