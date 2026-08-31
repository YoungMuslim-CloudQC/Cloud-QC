import { db } from "@/lib/db";
import { getVisitTotal, type MemberStat } from "@/lib/queries";

export async function TeamStats({ members }: { members: MemberStat[] }) {
  const [visitTotal, notSent] = await Promise.all([
    getVisitTotal(),
    db.visit.count({ where: { feedbackSent: false } }),
  ]);
  const avg =
    members.length > 0
      ? Math.round((visitTotal / members.length) * 10) / 10
      : 0;

  return (
    <div className="stat-grid">
      <div className="stat-card">
        <div className="stat-label">Cloud members</div>
        <div className="stat-value">{members.length}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Total visits</div>
        <div className="stat-value">{visitTotal}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Avg visits / member</div>
        <div className="stat-value">{avg}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Feedback not sent yet</div>
        <div className="stat-value">{notSent}</div>
      </div>
    </div>
  );
}
