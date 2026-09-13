import Link from "next/link";

import { Avatar } from "@/components/Avatar";
import type { MemberStat } from "@/lib/queries";

export function MemberList({
  members,
  activeId,
}: {
  members: MemberStat[];
  activeId?: string;
}) {
  if (members.length === 0) {
    return (
      <div className="empty-state">
        <strong>No Cloud members yet</strong>
        Members appear here once an admin approves their account.
      </div>
    );
  }

  return (
    <div className="nn-select-list">
      {members.map((m) => (
        <Link
          key={m.id}
          href={`/team/${m.id}`}
          className={`nn-select-item${m.id === activeId ? " active" : ""}`}
        >
          <div className="member-select-item">
            <Avatar name={m.name} image={m.image} />
            <div>
              <div className="nsi-name">{m.name}</div>
              <div className="nsi-city">
                {m.distinctNeighbornets} neighbornet
                {m.distinctNeighbornets === 1 ? "" : "s"} · {m.visitCount} visit
                {m.visitCount === 1 ? "" : "s"}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
