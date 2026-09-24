import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { memberName, visitedByLabel } from "@/lib/queries";
import { hysteresisStatus } from "@/lib/neighbornet-status";
import { isoDate, statusMeta } from "@/lib/format";
import { AttendanceChart } from "@/components/neighbornets/AttendanceChart";
import { FeedbackSentToggle } from "@/components/neighbornets/FeedbackSentToggle";
import {
  archiveNeighbornet,
  unarchiveNeighbornet,
} from "@/server/actions/neighbornets";

export async function NeighbornetDetail({
  id,
  isAdmin = false,
}: {
  id: string;
  isAdmin?: boolean;
}) {
  const nn = await db.neighbornet.findUnique({
    where: { id },
    include: {
      archivedBy: { select: { name: true, email: true } },
      rotations: {
        where: { endedOn: null },
        orderBy: { startedOn: "asc" },
        include: { user: { select: { name: true, email: true } } },
      },
      // The credit-bearing link — a joint event across several NNs shows up
      // here once for this NN, and Bash/SR events never appear at all.
      visitLinks: {
        where: { visit: { deletedAt: null } },
        orderBy: { visit: { visitDate: "asc" } },
        include: {
          visit: {
            include: {
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
          },
        },
      },
    },
  });

  if (!nn) notFound();

  const visits = nn.visitLinks.map((l) => l.visit);
  const archived = nn.archivedAt != null;
  const partnerLabel = nn.rotations.length
    ? nn.rotations.map((r) => memberName(r.user)).join(", ")
    : "Unassigned";

  const displayStatus = hysteresisStatus(visits);
  const displayMeta = statusMeta(displayStatus);

  const chartPoints = visits
    .filter((v) => v.groupSize != null)
    .map((v) => ({ date: isoDate(v.visitDate), value: v.groupSize as number }));

  const contactBits = [nn.contactEmail, nn.instagram].filter(Boolean);

  return (
    <>
      <div className="section-label">
        <span>
          {nn.name}
          {nn.subArea ? ` — ${nn.subArea}` : ""}
        </span>
        <span style={{ display: "flex", gap: 6 }}>
          {nn.stage === "EXPANSION" && (
            <span className="badge badge-event" title="Still in training — not yet an established NN">
              Expansion
            </span>
          )}
          {archived && (
            <span className="badge badge-neutral" title="This neighbornet is archived">
              Archived
            </span>
          )}
          {!archived && displayStatus && (
            <span
              className={`badge ${displayMeta.cls}`}
              title="Rolled-up status across visit history"
            >
              {displayMeta.label}
            </span>
          )}
          <span className="badge badge-neutral">Partners: {partnerLabel}</span>
        </span>
      </div>

      {archived && (
        <div
          className="shared-banner"
          style={{ borderLeftColor: "var(--text-muted)" }}
        >
          Archived{nn.archivedAt ? ` ${isoDate(nn.archivedAt)}` : ""}
          {nn.archivedBy ? ` by ${memberName(nn.archivedBy)}` : ""}. It&apos;s
          hidden from the neighbornet list, feedback form, rotation, and map —
          its past visits still count in all stats.
        </div>
      )}

      {isAdmin && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          <Link
            className="btn btn-secondary btn-small"
            href={`/neighbornets/${nn.id}/edit`}
          >
            Edit
          </Link>
          <form action={archived ? unarchiveNeighbornet : archiveNeighbornet}>
            <input type="hidden" name="id" value={nn.id} />
            <button
              type="submit"
              className={`btn btn-small ${archived ? "btn-primary" : "btn-secondary"}`}
              style={archived ? { width: "auto" } : undefined}
            >
              {archived ? "Unarchive" : "Archive"}
            </button>
          </form>
        </div>
      )}

      {contactBits.length > 0 && (
        <div
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            marginBottom: 14,
          }}
        >
          {contactBits.join(" · ")}
        </div>
      )}

      {nn.stage === "EXPANSION" && (
        <div className="shared-banner" style={{ marginBottom: 14 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "4px 14px",
              fontSize: 13,
            }}
          >
            <div style={{ color: "var(--text-muted)" }}>Media lead</div>
            <div>{nn.mediaLead ?? "—"}</div>
            <div style={{ color: "var(--text-muted)" }}>Number</div>
            <div>{nn.phone ?? "—"}</div>
            <div style={{ color: "var(--text-muted)" }}>Drive uploads</div>
            <div>{nn.driveUploads ? "Yes" : nn.driveUploads === false ? "No" : "—"}</div>
            <div style={{ color: "var(--text-muted)" }}>Posting consistently</div>
            <div>
              {nn.postingConsistently ? "Yes" : nn.postingConsistently === false ? "No" : "—"}
            </div>
          </div>
          {nn.expansionComments && (
            <div style={{ marginTop: 10, fontSize: 13, whiteSpace: "pre-wrap" }}>
              {nn.expansionComments}
            </div>
          )}
        </div>
      )}

      {visits.length === 0 ? (
        <div className="empty-state">
          <strong>No visits logged for this neighbornet</strong>
          Submit a QC feedback entry to start tracking it.
        </div>
      ) : (
        <>
          <AttendanceChart points={chartPoints} />
          <div className="table-mobile-cards">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Visited by</th>
                  <th>Attendance</th>
                  <th>Status</th>
                  <th>Feedback sent</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...visits].reverse().map((v) => {
                  const meta = statusMeta(v.status);
                  return (
                    <tr key={v.id}>
                      <td className="cell-mono" data-label="Date">
                        <Link href={`/visits/${v.id}?from=nn:${nn.id}`}>
                          {isoDate(v.visitDate)}
                        </Link>
                      </td>
                      <td data-label="Visited by">
                        {visitedByLabel(v.submittedBy, v.participants)}
                      </td>
                      <td className="cell-mono" data-label="Attendance">
                        {v.groupSize ?? "—"}
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${meta.cls}`}>{meta.label}</span>
                      </td>
                      <td data-label="Feedback sent">
                        <FeedbackSentToggle
                          visitId={v.id}
                          sent={v.feedbackSent}
                        />
                      </td>
                      <td data-label="Notes">
                        {v.notes ? (
                          <div style={{ whiteSpace: "pre-wrap" }}>
                            {v.notes}
                            {v.comments.map((c) => (
                              <div
                                key={c.id}
                                style={{
                                  marginTop: 6,
                                  color: "var(--text-muted)",
                                }}
                              >
                                — {memberName(c.author)}: {c.body}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
