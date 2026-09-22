import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { hysteresisStatus } from "@/lib/neighbornet-status";

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

/** Total logged visits = participant rows (of live visits) + manual offset. */
export async function getVisitTotal() {
  const [participants, settings] = await Promise.all([
    db.visitParticipant.count({ where: { visit: { deletedAt: null } } }),
    getSettings(),
  ]);
  return Math.max(0, participants + settings.manualOffset);
}

const VISIT_DETAIL_INCLUDE = {
  neighbornets: {
    include: { neighbornet: { select: { id: true, name: true, subArea: true } } },
  },
  submittedBy: { select: { id: true, name: true, email: true } },
  participants: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  comments: {
    orderBy: { createdAt: "asc" },
    include: { author: { select: { name: true, email: true } } },
  },
  history: {
    orderBy: { performedAt: "asc" },
    include: { performedBy: { select: { name: true, email: true } } },
  },
} satisfies Prisma.VisitInclude;

export async function getVisitWithHistory(id: string) {
  return db.visit.findUnique({
    where: { id },
    include: VISIT_DETAIL_INCLUDE,
  });
}

/** Resolve the `?from=` hint on /visits/[id] to a back-link target.
 *  Falls back to the user's feedback history. */
export async function resolveVisitBackTarget(
  from: string | undefined,
): Promise<{ href: string; label: string }> {
  if (from?.startsWith("nn:")) {
    const id = from.slice(3);
    const nn = await db.neighbornet.findUnique({
      where: { id },
      select: { name: true },
    });
    if (nn) return { href: `/neighbornets/${id}`, label: nn.name };
  }
  if (from?.startsWith("member:")) {
    const id = from.slice(7);
    const u = await db.user.findUnique({
      where: { id },
      select: { name: true, email: true },
    });
    if (u) return { href: `/team/${id}`, label: memberName(u) };
  }
  if (from === "deleted") {
    return { href: "/admin/deleted-visits", label: "Deleted visits" };
  }
  return { href: "/feedback", label: "your feedback" };
}

export async function getDeletedVisits() {
  return db.visit.findMany({
    where: { deletedAt: { not: null } },
    orderBy: { deletedAt: "desc" },
    include: VISIT_DETAIL_INCLUDE,
  });
}

export type PersonalDashboard = {
  stats: {
    totalVisits: number;
    distinctNeighbornets: number;
    pending: number;
  };
  recentVisits: {
    id: string;
    neighbornetName: string;
    visitDate: Date;
    status: string | null;
  }[];
  pairedNeighbornetIds: string[];
};

/** The signed-in user's own numbers for the dashboard "Yours" section. */
export async function getPersonalDashboard(
  userId: string,
): Promise<PersonalDashboard> {
  const [participations, rotations] = await Promise.all([
    db.visitParticipant.findMany({
      where: { userId, visit: { deletedAt: null } },
      orderBy: { visit: { visitDate: "desc" } },
      select: {
        visit: {
          select: {
            id: true,
            visitDate: true,
            status: true,
            feedbackSent: true,
            neighbornets: { select: { neighbornetId: true, neighbornet: { select: { name: true } } } },
          },
        },
      },
    }),
    db.rotationAssignment.findMany({
      where: { userId, endedOn: null },
      select: { neighbornetId: true },
    }),
  ]);

  // One participant row per Visit record (unique(visitId,userId)), so
  // participations.length is already "points" — a joint event across N NNs
  // is still exactly one row here. Distinct NNs is a separate, secondary count.
  const distinct = new Set(
    participations.flatMap((p) => p.visit.neighbornets.map((l) => l.neighbornetId)),
  );

  return {
    stats: {
      totalVisits: participations.length,
      distinctNeighbornets: distinct.size,
      pending: participations.filter((p) => !p.visit.feedbackSent).length,
    },
    recentVisits: participations.slice(0, 5).map((p) => ({
      id: p.visit.id,
      neighbornetName:
        p.visit.neighbornets.map((l) => l.neighbornet.name).join(", ") || "Sub-region event",
      visitDate: p.visit.visitDate,
      status: p.visit.status,
    })),
    pairedNeighbornetIds: rotations.map((r) => r.neighbornetId),
  };
}

export type MemberStat = {
  id: string;
  name: string;
  email: string | null;
  image: string | null;
  role: "MEMBER" | "ADMIN" | "COORDINATOR";
  visitCount: number;
  distinctNeighbornets: number;
  pending: number;
  lastVisit: Date | null;
  representingNeighbornet: { id: string; name: string } | null;
};

/** Per-member visit stats, derived from participant rows (which cover both
 *  submitters and co-visitors). */
export async function getTeamMemberStats(): Promise<MemberStat[]> {
  const [members, participants] = await Promise.all([
    db.user.findMany({
      where: { status: "APPROVED", role: { not: "COORDINATOR" } },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        representingNeighbornet: { select: { id: true, name: true } },
      },
    }),
    db.visitParticipant.findMany({
      where: { visit: { deletedAt: null } },
      select: {
        userId: true,
        visit: {
          select: {
            visitDate: true,
            feedbackSent: true,
            neighbornets: { select: { neighbornetId: true } },
          },
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
    const nnSet = new Set(rows.flatMap((r) => r.visit.neighbornets.map((l) => l.neighbornetId)));
    const last = rows.reduce<Date | null>(
      (acc, r) =>
        !acc || r.visit.visitDate > acc ? r.visit.visitDate : acc,
      null,
    );
    return {
      id: m.id,
      name: memberName(m),
      email: m.email,
      image: m.image,
      role: m.role,
      // One row per Visit record this member is on — a joint event across
      // several NNs is still exactly one here. This is the "points" metric.
      visitCount: rows.length,
      distinctNeighbornets: nnSet.size,
      pending: rows.filter((r) => !r.visit.feedbackSent).length,
      lastVisit: last,
      representingNeighbornet: m.representingNeighbornet,
    };
  });
}

/** Every active neighbornet, grouped for a <select>'s <optgroup>s — used by
 *  the "which neighbornet do you represent" picker on /profile. */
export async function getNeighbornetOptions(): Promise<
  { id: string; name: string; region: string; subArea: string | null }[]
> {
  return db.neighbornet.findMany({
    where: { archivedAt: null },
    orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
    select: { id: true, name: true, region: true, subArea: true },
  });
}

/** Members ranked by points — one point per distinct Visit record they're a
 *  participant on, regardless of how many neighbornets it's tagged to (a
 *  joint event across several NNs, or an SR event/Bash with none, is still
 *  worth exactly one point). Ties broken by distinct neighbornets reached,
 *  then name — the Cloud Team leaderboard. */
export function rankByPoints(members: MemberStat[]): MemberStat[] {
  return [...members].sort((a, b) => {
    if (b.visitCount !== a.visitCount) return b.visitCount - a.visitCount;
    if (b.distinctNeighbornets !== a.distinctNeighbornets) {
      return b.distinctNeighbornets - a.distinctNeighbornets;
    }
    return a.name.localeCompare(b.name);
  });
}

export type NeighbornetSummary = Awaited<
  ReturnType<typeof getNeighbornetSummaries>
>[number];

export type RegionMap = { region: string; subAreas: string[] }[];

/** Live region -> subArea directory, derived from actual neighbornet data
 *  rather than a hardcoded list — used to build the home-location and
 *  digest-region pickers on /profile so they never drift from what
 *  neighbornets actually exist. */
export async function getRegionMap(): Promise<RegionMap> {
  const rows = await db.neighbornet.findMany({
    where: { archivedAt: null, subArea: { not: null } },
    select: { region: true, subArea: true },
    distinct: ["region", "subArea"],
    orderBy: [{ region: "asc" }, { subArea: "asc" }],
  });
  const byRegion = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.subArea) continue;
    const list = byRegion.get(r.region) ?? [];
    list.push(r.subArea);
    byRegion.set(r.region, list);
  }
  return [...byRegion.entries()].map(([region, subAreas]) => ({ region, subAreas }));
}

/** Distinct 2-letter state codes already in use — seeds the location picker. */
export async function getUsedStateCodes(): Promise<string[]> {
  const rows = await db.neighbornet.findMany({
    where: { stateCode: { not: null } },
    select: { stateCode: true },
    distinct: ["stateCode"],
    orderBy: { stateCode: "asc" },
  });
  return rows
    .map((r) => r.stateCode)
    .filter((c): c is string => Boolean(c))
    .map((c) => c.toUpperCase());
}

/** Neighbornets with their latest visit and current rotation partners.
 *  Defaults to active (non-archived) neighbornets. */
export async function getNeighbornetSummaries(
  { archived = false }: { archived?: boolean } = {},
) {
  const neighbornets = await db.neighbornet.findMany({
    where: { archivedAt: archived ? { not: null } : null },
    orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
    include: {
      // The credit-bearing link — SR/Bash events never appear here, and a
      // joint event across several NNs shows up once per NN, as intended.
      visitLinks: {
        where: { visit: { deletedAt: null } },
        orderBy: { visit: { visitDate: "desc" } },
        select: {
          visit: { select: { id: true, visitDate: true, status: true } },
        },
      },
      rotations: {
        where: { endedOn: null },
        orderBy: { startedOn: "asc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return neighbornets.map((n) => {
    const visits = n.visitLinks.map((l) => l.visit);
    return {
      ...n,
      latitude: n.latitude ? Number(n.latitude) : null,
      longitude: n.longitude ? Number(n.longitude) : null,
      latestVisit: visits[0] ?? null,
      // Hysteresis roll-up over the whole visit history — this is the status
      // shown on the dashboard, map pins, and cards.
      displayStatus: hysteresisStatus(visits),
      partners: n.rotations.map((r) => ({
        id: r.user.id,
        name: memberName(r.user),
        since: r.startedOn,
      })),
      visitCount: visits.length,
    };
  });
}
