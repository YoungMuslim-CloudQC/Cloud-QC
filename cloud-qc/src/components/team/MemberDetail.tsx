import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/lib/db";
import { memberName } from "@/lib/queries";
import { isoDate } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { FeedbackSentToggle } from "@/components/neighbornets/FeedbackSentToggle";
import { AdminEditMemberProfile } from "@/components/team/AdminEditMemberProfile";

export async function MemberDetail({
  id,
  isAdmin = false,
}: {
  id: string;
  isAdmin?: boolean;
}) {
  const member = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      image: true,
      phone: true,
    },
  });
  if (!member || member.status !== "APPROVED") notFound();

  const participations = await db.visitParticipant.findMany({
    where: { userId: id, visit: { deletedAt: null } },
    include: {
      visit: {
        include: { neighbornet: { select: { name: true } } },
      },
    },
    orderBy: { visit: { visitDate: "desc" } },
  });

  const name = memberName(member);
  const distinctNn = new Set(participations.map((p) => p.visit.neighbornetId))
    .size;
  const last = participations[0]?.visit.visitDate ?? null;

  return (
    <>
      <div className="section-label">
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar name={name} image={member.image} />
          {name}
        </span>
        <span className="badge badge-neutral">
          {participations.filter((p) => !p.visit.feedbackSent).length} pending
        </span>
      </div>

      {isAdmin && (
        <AdminEditMemberProfile
          userId={member.id}
          name={name}
          image={member.image}
          phone={member.phone}
        />
      )}

      <div
        className="stat-grid"
        style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}
      >
        <div className="stat-card">
          <div className="stat-label">Neighbornets visited</div>
          <div className="stat-value">{distinctNn}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total visits</div>
          <div className="stat-value">{participations.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Last visit</div>
          <div className="stat-value" style={{ fontSize: 16 }}>
            {last ? isoDate(last) : "—"}
          </div>
        </div>
      </div>

      {participations.length === 0 ? (
        <div className="empty-state">
          <strong>No visits logged yet</strong>
          Once {name} is part of a visit, it will show up here.
        </div>
      ) : (
        <div className="table-mobile-cards">
          <table>
            <thead>
              <tr>
                <th>Neighbornet</th>
                <th>Visit date</th>
                <th>Form filled</th>
                <th>Feedback sent</th>
              </tr>
            </thead>
            <tbody>
              {participations.map((p) => {
                const filled = p.role === "SUBMITTER" || p.contributed;
                return (
                  <tr key={p.id}>
                    <td data-label="Neighbornet">
                      <Link href={`/visits/${p.visit.id}?from=member:${id}`}>
                        {p.visit.neighbornet.name}
                      </Link>
                    </td>
                    <td className="cell-mono" data-label="Visit date">
                      {isoDate(p.visit.visitDate)}
                    </td>
                    <td data-label="Form filled">
                      <span
                        className={`badge ${
                          filled ? "badge-success" : "badge-neutral"
                        }`}
                      >
                        {filled ? "Yes" : "Via teammate"}
                      </span>
                    </td>
                    <td data-label="Feedback sent">
                      <FeedbackSentToggle
                        visitId={p.visit.id}
                        sent={p.visit.feedbackSent}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
