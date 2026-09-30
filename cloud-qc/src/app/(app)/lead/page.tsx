import Link from "next/link";

import { requireCloudLead } from "@/lib/authz";
import { getCloudTeamOverview, QUIET_DAYS } from "@/lib/cloud-lead";
import { isoDate } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

/** The Cloud Lead's view of the QC team: who's active, who's gone quiet,
 *  and how the work is spread. A lead is a QC member too, so they keep
 *  everything else — this is additional, not instead. */
export default async function CloudLeadPage() {
  const me = await requireCloudLead();

  const { members, active, quiet, visitsThisMonth, visitsAllTime } =
    await getCloudTeamOverview();
  const quietMembers = members.filter(
    (m) => m.quietFor === null || m.quietFor > QUIET_DAYS,
  );
  return (
    <>
      <PageHead
        title="Team overview"
        desc="Who's active, who's gone quiet, and how the work is spread."
      />

      <div className="co-stat-grid">
        <div className="co-stat">
          <div className="co-stat-label">Team size</div>
          <div className="co-stat-value">{members.length}</div>
          <div className="co-stat-sub">QC members</div>
        </div>
        <div className="co-stat">
          <div className="co-stat-label">Active</div>
          <div className="co-stat-value">{active}</div>
          <div className="co-stat-sub">logged a visit in {QUIET_DAYS} days</div>
        </div>
        <div className={`co-stat${quiet > 0 ? " attention" : ""}`}>
          <div className="co-stat-label">Gone quiet</div>
          <div className="co-stat-value">{quiet}</div>
          <div className="co-stat-sub">
            {quiet === 0 ? "everyone's been out" : `no visit in ${QUIET_DAYS}+ days`}
          </div>
        </div>
        <div className="co-stat">
          <div className="co-stat-label">Visits this month</div>
          <div className="co-stat-value">{visitsThisMonth}</div>
          <div className="co-stat-sub">{visitsAllTime} all time</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
        <Link className="btn btn-secondary" href="/team">
          Leaderboard
        </Link>
        <Link className="btn btn-secondary" href="/rotation">
          Rotation
        </Link>
        <Link className="btn btn-secondary" href="/org">
          Org map
        </Link>
      </div>

      {quiet > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">
            <span>Worth a check-in</span>
            <span className="survey-time-note">{quiet}</span>
          </div>
          <div className="lead-grid">
            {quietMembers.map((m) => (
              <Link className="lead-person" href={`/team/${m.id}`} key={m.id}>
                <Avatar name={m.name} image={m.image} />
                <div style={{ minWidth: 0 }}>
                  <div className="lead-person-name">{m.name}</div>
                  <div className="lead-person-sub">
                    {m.lastVisit
                      ? `last visit ${isoDate(m.lastVisit)} · ${m.quietFor} days ago`
                      : "no visits logged yet"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="section-label">
          <span>Everyone</span>
          <span className="survey-time-note">{members.length}</span>
        </div>
        <div className="table-mobile-cards">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Visits</th>
                <th>Neighbornets</th>
                <th>Not sent</th>
                <th>Last visit</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td data-label="Member">
                    <Link href={`/team/${m.id}`}>{m.name}</Link>
                    {m.id === me.id && (
                      <span className="optional-tag"> · you</span>
                    )}
                    {m.role === "ADMIN" && (
                      <span className="badge badge-neutral" style={{ marginLeft: 6 }}>
                        Admin
                      </span>
                    )}
                  </td>
                  <td className="cell-mono" data-label="Visits">
                    {m.visitCount}
                  </td>
                  <td className="cell-mono" data-label="Neighbornets">
                    {m.distinctNeighbornets}
                  </td>
                  <td className="cell-mono" data-label="Not sent">
                    {m.pending}
                  </td>
                  <td data-label="Last visit">
                    {m.lastVisit ? isoDate(m.lastVisit) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
