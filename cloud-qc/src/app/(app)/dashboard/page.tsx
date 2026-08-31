import { db } from "@/lib/db";
import { getSettings, memberName } from "@/lib/queries";
import { getNeighbornetSummaries } from "@/lib/queries";
import { isoDate, statusMeta } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import { Orbit } from "@/components/dashboard/Orbit";
import { NeighbornetBoard } from "@/components/dashboard/NeighbornetBoard";
import type { MapNeighbornet } from "@/components/NetworkMap";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summaries, settings, participantCount, visitAgg, recent] =
    await Promise.all([
      getNeighbornetSummaries(),
      getSettings(),
      db.visitParticipant.count(),
      db.visit.aggregate({ _sum: { groupSize: true }, _count: true }),
      db.visit.findMany({
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
    ]);

  const visitTotal = Math.max(0, participantCount + settings.manualOffset);
  const avgAttendance = visitAgg._count
    ? Math.round((visitAgg._sum.groupSize ?? 0) / visitAgg._count)
    : 0;
  const needsFollowup = summaries.filter(
    (n) =>
      n.latestVisit?.status === "NEEDS_FOLLOWUP" ||
      n.latestVisit?.status === "URGENT",
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
    latestStatus: n.latestVisit?.status ?? null,
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

      <div className="two-col">
        <div className="card">
          <div className="section-label">Network</div>
          <div className="orbit-wrap">
            <Orbit
              nodes={summaries.map((n) => ({
                id: n.id,
                name: n.name,
                status: n.latestVisit?.status ?? null,
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
