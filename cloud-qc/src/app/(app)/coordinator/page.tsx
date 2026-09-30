import Link from "next/link";

import { requireViewRole } from "@/lib/authz";
import { getCoordinatorStats } from "@/lib/coordinator-stats";
import { isoDate, statusMeta } from "@/lib/format";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

function rating(n: number | null) {
  return n == null ? "—" : n.toFixed(1);
}

function daysAgo(d: Date | null): string {
  if (!d) return "never";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

/** The coordinator's home: how their neighbornet is doing at a glance, and
 *  what's waiting on them. Identical for an SR coordinator — the only
 *  difference is how many neighbornets it covers. */
export default async function CoordinatorDashboard() {
  const user = await requireViewRole();
  const { nns, totals } = await getCoordinatorStats(user.id, user.scope);

  if (nns.length === 0) {
    return (
      <>
        <PageHead title="Your neighbornet" desc="How things are going." />
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="empty-state">
            <strong>Nothing linked yet</strong>
            An admin needs to link your account to the neighbornet or
            sub-region you look after before anything shows up here.
          </div>
        </div>
      </>
    );
  }

  const single = nns.length === 1 ? nns[0] : null;

  return (
    <>
      <PageHead
        title={single ? single.name : "Your sub-region"}
        desc={
          single
            ? "How QC says it's going, and what's waiting on you."
            : `How QC says your ${nns.length} neighbornets are going.`
        }
      />

      <div className="co-stat-grid">
        <div className={`co-stat${totals.unreviewed > 0 ? " attention" : ""}`}>
          <div className="co-stat-label">To review</div>
          <div className="co-stat-value">{totals.unreviewed}</div>
          <div className="co-stat-sub">
            {totals.unreviewed === 0
              ? "You're all caught up"
              : `of ${totals.visitCount} visits logged`}
          </div>
        </div>
        <div className="co-stat">
          <div className="co-stat-label">Last QC visit</div>
          <div className="co-stat-value" style={{ fontSize: 19 }}>
            {daysAgo(totals.lastVisitDate)}
          </div>
          <div className="co-stat-sub">
            {totals.lastVisitDate ? isoDate(totals.lastVisitDate) : "no visits yet"}
          </div>
        </div>
        <div className="co-stat">
          <div className="co-stat-label">Needs follow-up</div>
          <div className="co-stat-value">{totals.needsFollowup}</div>
          <div className="co-stat-sub">visits flagged by QC</div>
        </div>
        <div className="co-stat">
          <div className="co-stat-label">Visits logged</div>
          <div className="co-stat-value">{totals.visitCount}</div>
          <div className="co-stat-sub">all time</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        <Link className="btn btn-primary" href="/coordinator/inbox" style={{ width: "auto" }}>
          {totals.unreviewed > 0
            ? `Read ${totals.unreviewed} new ${totals.unreviewed === 1 ? "note" : "notes"}`
            : "Open the feedback inbox"}
        </Link>
        <Link className="btn btn-secondary" href="/coordinator/team">
          Your core team
        </Link>
        {user.scope.nationalRollup && (
          <Link className="btn btn-secondary" href="/coordinator/national">
            National rollup
          </Link>
        )}
      </div>

      <div className="section-label">
        <span>{single ? "Ratings" : "Each neighbornet"}</span>
      </div>
      <div className="co-nn-grid">
        {nns.map((n) => {
          const meta = statusMeta(n.status);
          return (
            <div className="co-nn" key={n.id}>
              <div className="co-nn-top">
                <span className="co-nn-name">{n.name}</span>
                {n.visitCount === 0 ? (
                  <span className="badge badge-neutral">No visits yet</span>
                ) : (
                  <span className={`badge ${meta.cls}`}>{meta.label}</span>
                )}
              </div>
              <dl className="co-nn-rows">
                <dt>Food</dt>
                <dd>{rating(n.food)}</dd>
                <dt>Leadership</dt>
                <dd>{rating(n.leadership)}</dd>
                <dt>Halaqah</dt>
                <dd>{rating(n.halaqah)}</dd>
                <dt>Last visit</dt>
                <dd>
                  {n.lastVisitDate ? isoDate(n.lastVisitDate) : "—"}
                  {n.lastVisitBy && (
                    <span style={{ color: "var(--text-muted)" }}> · {n.lastVisitBy}</span>
                  )}
                </dd>
                <dt>Follow-ups</dt>
                <dd>{n.needsFollowup}</dd>
              </dl>
              {n.unreviewed > 0 && (
                <Link
                  className="btn btn-secondary btn-small"
                  href={`/coordinator/inbox?nn=${n.id}`}
                  style={{ width: "auto" }}
                >
                  {n.unreviewed} to review →
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
