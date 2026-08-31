import Link from "next/link";

import type { PersonalDashboard } from "@/lib/queries";
import { needsFollowup } from "@/lib/neighbornet-status";
import { isoDate, statusMeta } from "@/lib/format";

type PairedNeighbornet = {
  id: string;
  name: string;
  subArea: string;
  displayStatus: string | null;
};

export function YoursSection({
  stats,
  recentVisits,
  pairedNeighbornets,
}: {
  stats: PersonalDashboard["stats"];
  recentVisits: PersonalDashboard["recentVisits"];
  pairedNeighbornets: PairedNeighbornet[];
}) {
  const flagged = pairedNeighbornets.filter((n) =>
    needsFollowup(n.displayStatus),
  ).length;

  return (
    <section style={{ marginTop: 8, marginBottom: 28 }}>
      <div className="section-label">
        <span>Yours</span>
        <span
          style={{ fontWeight: 400, fontSize: 12, color: "var(--text-muted)" }}
        >
          just your activity
        </span>
      </div>

      <div
        className="stat-grid"
        style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 16 }}
      >
        <div className="stat-card">
          <div className="stat-label">Your visits</div>
          <div className="stat-value">{stats.totalVisits}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Neighbornets visited</div>
          <div className="stat-value">{stats.distinctNeighbornets}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Feedback not sent</div>
          <div className="stat-value">{stats.pending}</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <div className="section-label">
            <span>Your rotation</span>
            {flagged > 0 && (
              <span className="badge badge-warn">{flagged} need attention</span>
            )}
          </div>
          {pairedNeighbornets.length === 0 ? (
            <div className="empty-state">
              <strong>Not paired with anyone yet</strong>
              Join a pairing on the{" "}
              <Link href="/rotation">Rotation</Link> page.
            </div>
          ) : (
            <div className="nn-select-list">
              {pairedNeighbornets.map((n) => {
                const flag = needsFollowup(n.displayStatus);
                const meta = statusMeta(n.displayStatus);
                return (
                  <Link
                    key={n.id}
                    href={`/neighbornets/${n.id}`}
                    className="nn-select-item"
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span>
                        <span className="nsi-name">{n.name}</span>
                        <span className="nsi-city">{n.subArea}</span>
                      </span>
                      {flag && (
                        <span className={`badge ${meta.cls}`}>{meta.label}</span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="section-label">Your recent visits</div>
          {recentVisits.length === 0 ? (
            <div className="empty-state">
              <strong>No visits logged yet</strong>
              Submit one from{" "}
              <Link href="/feedback">Submit Feedback</Link>.
            </div>
          ) : (
            recentVisits.map((v) => {
              const meta = statusMeta(v.status);
              return (
                <Link
                  key={v.id}
                  href={`/visits/${v.id}`}
                  className="visit-row"
                  style={{
                    gridTemplateColumns: "90px 1fr auto",
                    textDecoration: "none",
                  }}
                >
                  <div className="visit-date">{isoDate(v.visitDate)}</div>
                  <div className="visit-nn">{v.neighbornetName}</div>
                  <div>
                    <span className={`badge ${meta.cls}`}>{meta.label}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
