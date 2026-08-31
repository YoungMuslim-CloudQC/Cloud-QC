import { db } from "@/lib/db";
import { requireApproved } from "@/lib/authz";
import {
  getSettings,
  memberName,
  getNeighbornetSummaries,
  getPersonalDashboard,
} from "@/lib/queries";
import { needsFollowup as isFollowup } from "@/lib/neighbornet-status";
import { isoDate, statusMeta } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import { Orbit } from "@/components/dashboard/Orbit";
import { NeighbornetBoard } from "@/components/dashboard/NeighbornetBoard";
import { YoursSection } from "@/components/dashboard/YoursSection";
import type { MapNeighbornet } from "@/components/NetworkMap";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireApproved();
  const [summaries, settings, participantCount, visitAgg, recent, personal] =
    await Promise.all([
      getNeighbornetSummaries(),
      getSettings(),
      db.visitParticipant.count({ where: { visit: { deletedAt: null } } }),
      db.visit.aggregate({
        where: { deletedAt: null },
        _sum: { groupSize: true },
        _count: true,
      }),
      db.visit.findMany({
        where: { deletedAt: null },
        orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
        take: 6,
        include: {
          neighbornet: { select: { name: true } },
          submittedBy: { select: { name: true, email: true } },
          participants: {
            where: { role: "CO_VISITOR" },
            include: { user: { select: { name: true, email: true } } },
          },
        },
      }),
      getPersonalDashboard(user.id),
    ]);

  const pairedSet = new Set(personal.pairedNeighbornetIds);
  const myPaired = summaries
    .filter((s) => pairedSet.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.name,
      subArea: s.subArea,
      displayStatus: s.displayStatus,
    }));

  const visitTotal = Math.max(0, participantCount + settings.manualOffset);
  const avgAttendance = visitAgg._count
    ? Math.round((visitAgg._sum.groupSize ?? 0) / visitAgg._count)
    : 0;
  const needsFollowup = summaries.filter((n) =>
    isFollowup(n.displayStatus),
  ).length;

  const goalPct =
    settings.goal && settings.goal > 0
      ? Math.min(100, Math.round((visitTotal / settings.goal) * 100))
      : null;

  const mapData: MapNeighbornet[] = summaries.map((n) => ({
    id: n.id,
    name: n.name,
    subArea: n.subArea,
    region: n.region,
    stateCode: n.stateCode,
    latitude: n.latitude,
    longitude: n.longitude,
    status: n.displayStatus,
    lastVisitDate: n.latestVisit ? isoDate(n.latestVisit.visitDate) : null,
    partners: n.partners.map((p) => p.name),
  }));

  return (
    <>
      <PageHead
        title="Cloud Dashboard"
        desc="Overview of QC visits across all neighbornets."
      />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Neighbornets</div>
          <div className="stat-value">{summaries.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Visits logged</div>
          <div className="stat-value">{visitTotal}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg. attendance</div>
          <div className="stat-value">{avgAttendance}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Needs follow-up</div>
          <div className="stat-value">{needsFollowup}</div>
        </div>
      </div>

      {goalPct !== null && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="progress-top">
            <span>Visit goal progress</span>
            <span>
              {visitTotal} / {settings.goal}
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${goalPct}%` }} />
          </div>
        </div>
      )}

      <YoursSection
        stats={personal.stats}
        recentVisits={personal.recentVisits}
        pairedNeighbornets={myPaired}
      />

      <div className="section-label">Across all of Cloud</div>
      <div className="two-col">
        <div className="card">
          <div className="section-label">Network</div>
          <div className="orbit-wrap">
            <Orbit
              nodes={summaries.map((n) => ({
                id: n.id,
                name: n.name,
                status: n.displayStatus,
              }))}
            />
          </div>
        </div>
        <div className="card">
          <div className="section-label">Recent visits</div>
          {recent.length === 0 ? (
            <div className="empty-state">
              <strong>No visits logged yet</strong>
              Submit your first QC visit to see it here.
            </div>
          ) : (
            recent.map((v) => {
              const extras = v.participants.map((p) => memberName(p.user));
              const by = extras.length
                ? `${memberName(v.submittedBy)} + ${extras.join(", ")}`
                : memberName(v.submittedBy);
              const meta = statusMeta(v.status);
              return (
                <div className="visit-row" key={v.id}>
                  <div className="visit-date">{isoDate(v.visitDate)}</div>
                  <div>
                    <div className="visit-nn">{v.neighbornet.name}</div>
                    <div className="visit-sub">by {by}</div>
                  </div>
                  <div className="visit-att">{v.groupSize ?? "—"}</div>
                  <div>
                    <span className={`badge ${meta.cls}`}>{meta.label}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <NeighbornetBoard neighbornets={mapData} />
      </div>
    </>
  );
}
