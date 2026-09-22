import Link from "next/link";

import { rankByPoints, type MemberStat } from "@/lib/queries";
import { Avatar } from "@/components/Avatar";

const RANK_CLASS: Record<number, string> = {
  1: "leaderboard-rank-gold",
  2: "leaderboard-rank-silver",
  3: "leaderboard-rank-bronze",
};

export function Leaderboard({ members }: { members: MemberStat[] }) {
  const ranked = rankByPoints(members).filter((m) => m.visitCount > 0);

  if (ranked.length === 0) {
    return (
      <div className="empty-state">
        <strong>No visits logged yet</strong>
        The leaderboard fills in once members start submitting QC feedback.
      </div>
    );
  }

  return (
    <div className="leaderboard">
      {ranked.map((m, i) => {
        const rank = i + 1;
        return (
          <Link key={m.id} href={`/team/${m.id}`} className="leaderboard-row">
            <div className={`leaderboard-rank ${RANK_CLASS[rank] ?? ""}`}>{rank}</div>
            <Avatar name={m.name} image={m.image} className="leaderboard-avatar" />
            <div className="leaderboard-info">
              <div className="leaderboard-name">{m.name}</div>
              <div className="leaderboard-sub">
                {m.representingNeighbornet
                  ? `Representing ${m.representingNeighbornet.name}`
                  : "No neighbornet chosen"}
                {" · "}
                {m.distinctNeighbornets} NN{m.distinctNeighbornets === 1 ? "" : "s"} reached
              </div>
            </div>
            <div className="leaderboard-metric">
              <div className="leaderboard-metric-value">{m.visitCount}</div>
              <div className="leaderboard-metric-label">
                point{m.visitCount === 1 ? "" : "s"}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
