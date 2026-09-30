import Link from "next/link";

import { db } from "@/lib/db";
import { requireViewRole } from "@/lib/authz";
import { memberName } from "@/lib/queries";
import { isoDate, statusMeta } from "@/lib/format";
import { EVENT_TYPE_LABEL } from "@/lib/visit-schema";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import {
  MarkAllReviewed,
  ReviewToggle,
} from "@/components/coordinator/ReviewToggle";

export const dynamic = "force-dynamic";

const INBOX_LIMIT = 100;

function rating(n: number | null) {
  return n == null ? "—" : `${n}/5`;
}

/** Everything QC has logged about the neighbornets this person looks after,
 *  laid out as masonry columns so a two-line note and a six-paragraph one
 *  can sit side by side without leaving gaps. */
export default async function CoordinatorInboxPage({
  searchParams,
}: PageProps<"/coordinator/inbox">) {
  const user = await requireViewRole();
  const { nn: nnParam, show } = await searchParams;
  const { scope } = user;
  const unreadOnly = show === "unread";

  const myNns = await db.neighbornet.findMany({
    where: {
      archivedAt: null,
      OR: [
        { id: { in: scope.fullNeighbornetIds } },
        ...(scope.fullSubregions.length
          ? [{ subArea: { in: scope.fullSubregions } }]
          : []),
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  if (myNns.length === 0) {
    return (
      <>
        <PageHead title="Feedback inbox" desc="Feedback about your neighbornet." />
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="empty-state">
            <strong>Nothing linked yet</strong>
            An admin needs to link your account before feedback shows up here.
          </div>
        </div>
      </>
    );
  }

  const selected =
    typeof nnParam === "string" && myNns.some((n) => n.id === nnParam) ? nnParam : "";

  const visits = await db.visit.findMany({
    where: {
      deletedAt: null,
      // The credit-bearing link — a joint event touching one of these shows
      // up here; a Bash/SR event never has one, so it can't.
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
      coordinatorReviews: { where: { userId: user.id }, select: { id: true } },
    },
  });

  const shown = unreadOnly
    ? visits.filter((v) => v.coordinatorReviews.length === 0)
    : visits;
  const unreadIds = visits
    .filter((v) => v.coordinatorReviews.length === 0)
    .map((v) => v.id);

  const chip = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`status-opt${active ? " sel-ok" : ""}`}
      style={{ textDecoration: "none" }}
    >
      {label}
    </Link>
  );
  const q = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    if (selected) p.set("nn", selected);
    if (unreadOnly) p.set("show", "unread");
    for (const [k, v] of Object.entries(over)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return `/coordinator/inbox${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <BackLink href="/coordinator" label="Your neighbornet" />
      <PageHead
        title="Feedback inbox"
        desc="Everything QC has logged. Mark each one off as you read it."
      />

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div className="status-options" style={{ margin: 0 }}>
          {chip(q({ show: "" }), `All ${visits.length}`, !unreadOnly)}
          {chip(q({ show: "unread" }), `Unread ${unreadIds.length}`, unreadOnly)}
        </div>
        <MarkAllReviewed visitIds={unreadIds} readOnly={Boolean(user.impersonating)} />
      </div>

      {myNns.length > 1 && (
        <div className="status-options" style={{ marginBottom: 18 }}>
          {chip(
            `/coordinator/inbox${unreadOnly ? "?show=unread" : ""}`,
            "Every neighbornet",
            selected === "",
          )}
          {myNns.map((n) =>
            chip(
              `/coordinator/inbox?nn=${n.id}${unreadOnly ? "&show=unread" : ""}`,
              n.name,
              selected === n.id,
            ),
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="empty-state">
            <strong>{unreadOnly ? "All caught up" : "No feedback yet"}</strong>
            {unreadOnly
              ? "You've read everything logged so far."
              : "When a QC member logs a visit, it will show up here."}
          </div>
        </div>
      ) : (
        <div className="feed-masonry">
          {shown.map((v) => {
            const meta = statusMeta(v.status);
            const isRead = v.coordinatorReviews.length > 0;
            const coVisitors = v.participants.map((p) => memberName(p.user));
            const by = coVisitors.length
              ? `${memberName(v.submittedBy)} + ${coVisitors.join(", ")}`
              : memberName(v.submittedBy);
            return (
              <div className={`card${isRead ? "" : " unread-rail"}`} key={v.id}>
                <div className="section-label">
                  <span>
                    {v.neighbornets.map((l) => l.neighbornet.name).join(", ")}
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
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    marginBottom: 10,
                  }}
                >
                  {isoDate(v.visitDate)} · {by}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    flexWrap: "wrap",
                    fontSize: 12.5,
                    marginBottom: 10,
                  }}
                >
                  <span>Food {rating(v.foodRating)}</span>
                  <span>Leadership {rating(v.leadershipRating)}</span>
                  <span>Halaqah {rating(v.halaqahRating)}</span>
                  {v.groupSize != null && <span>{v.groupSize} there</span>}
                  {v.avgAge != null && <span>avg age {v.avgAge}</span>}
                </div>

                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    fontSize: 13,
                    lineHeight: 1.55,
                    borderLeft: "2px solid var(--border)",
                    paddingLeft: 10,
                  }}
                >
                  {v.notes}
                  {v.comments.map((c) => (
                    <div key={c.id} style={{ marginTop: 8, color: "var(--text-muted)" }}>
                      — {memberName(c.author)}: {c.body}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 12 }}>
                  <ReviewToggle visitId={v.id} reviewed={isRead} readOnly={Boolean(user.impersonating)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {visits.length === INBOX_LIMIT && (
        <div className="survey-time-note">Showing the latest {INBOX_LIMIT}.</div>
      )}
    </>
  );
}
