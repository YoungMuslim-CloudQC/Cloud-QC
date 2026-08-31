import "server-only";

import { db } from "@/lib/db";

export function memberName(u: {
  name?: string | null;
  email?: string | null;
}): string {
  return u.name || u.email || "Member";
}

type Named = { name?: string | null; email?: string | null };

/** "Alice + Bob, Carol" — submitter plus any co-visitors. */
export function visitedByLabel(
  submittedBy: Named,
  coVisitors: { user: Named }[],
): string {
  const extras = coVisitors.map((c) => memberName(c.user));
  return extras.length
    ? `${memberName(submittedBy)} + ${extras.join(", ")}`
    : memberName(submittedBy);
}

export async function getSettings() {
  const rows = await db.appSetting.findMany({
    where: { key: { in: ["manual_visit_offset", "visit_goal"] } },
  });
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? null;
  const offsetRaw = get("manual_visit_offset");
  const goalRaw = get("visit_goal");
  return {
    manualOffset: typeof offsetRaw === "number" ? offsetRaw : 0,
    goal: typeof goalRaw === "number" ? goalRaw : null,
  };
}

/** Total logged visits = participant rows + manual offset (never negative). */
export async function getVisitTotal() {
  const [participants, settings] = await Promise.all([
    db.visitParticipant.count(),
    getSettings(),
  ]);
  return Math.max(0, participants + settings.manualOffset);
}

export type MemberStat = {
  id: string;
  name: string;
  email: string | null;
  role: "MEMBER" | "ADMIN";
  visitCount: number;
  distinctNeighbornets: number;
  pending: number;
  lastVisit: Date | null;
};

/** Per-member visit stats, derived from participant rows (which cover both
 *  submitters and co-visitors). */
export async function getTeamMemberStats(): Promise<MemberStat[]> {
  const [members, participants] = await Promise.all([
    db.user.findMany({
      where: { status: "APPROVED" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    db.visitParticipant.findMany({
      select: {
        userId: true,
        visit: {
          select: { neighbornetId: true, visitDate: true, feedbackSent: true },
        },
      },
    }),
  ]);

  const byUser = new Map<string, typeof participants>();
  for (const p of participants) {
    const arr = byUser.get(p.userId) ?? [];
    arr.push(p);
    byUser.set(p.userId, arr);
  }

  return members.map((m) => {
    const rows = byUser.get(m.id) ?? [];
    const nnSet = new Set(rows.map((r) => r.visit.neighbornetId));
    const last = rows.reduce<Date | null>(
      (acc, r) =>
        !acc || r.visit.visitDate > acc ? r.visit.visitDate : acc,
      null,
    );
    return {
      id: m.id,
      name: memberName(m),
      email: m.email,
      role: m.role,
      visitCount: rows.length,
      distinctNeighbornets: nnSet.size,
      pending: rows.filter((r) => !r.visit.feedbackSent).length,
      lastVisit: last,
    };
  });
}

export type NeighbornetSummary = Awaited<
  ReturnType<typeof getNeighbornetSummaries>
>[number];

/** Neighbornets with their latest visit and current rotation partners. */
export async function getNeighbornetSummaries() {
  const neighbornets = await db.neighbornet.findMany({
    where: { archivedAt: null },
    orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
    include: {
      visits: {
        orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { id: true, visitDate: true, status: true },
      },
      rotations: {
        where: { endedOn: null },
        orderBy: { startedOn: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { visits: true } },
    },
  });

  return neighbornets.map((n) => ({
    ...n,
    latitude: n.latitude ? Number(n.latitude) : null,
    longitude: n.longitude ? Number(n.longitude) : null,
    latestVisit: n.visits[0] ?? null,
    partners: n.rotations.map((r) => ({
      id: r.user.id,
      name: memberName(r.user),
      since: r.startedOn,
    })),
    visitCount: n._count.visits,
  }));
}
