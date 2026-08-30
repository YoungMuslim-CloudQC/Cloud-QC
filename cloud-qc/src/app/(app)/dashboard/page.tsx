import { db } from "@/lib/db";
import { PageHead } from "@/components/PageHead";

export default async function DashboardPage() {
  const [nnCount, visitParticipantCount, offsetSetting] = await Promise.all([
    db.neighbornet.count({ where: { archivedAt: null } }),
    db.visitParticipant.count(),
    db.appSetting.findUnique({ where: { key: "manual_visit_offset" } }),
  ]);
  const offset =
    typeof offsetSetting?.value === "number" ? offsetSetting.value : 0;

  return (
    <>
      <PageHead
        title="Cloud Dashboard"
        desc="Overview of QC visits across all neighbornets."
      />
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Neighbornets</div>
          <div className="stat-value">{nnCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Visits logged</div>
          <div className="stat-value">{visitParticipantCount + offset}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg. attendance</div>
          <div className="stat-value">0</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Needs follow-up</div>
          <div className="stat-value">0</div>
        </div>
      </div>
      <div className="card">
        <div className="empty-state">
          <strong>Dashboard widgets coming next</strong>
          Network graph, recent visits, and the neighbornet grid/map will be
          wired up in the next step.
        </div>
      </div>
    </>
  );
}
