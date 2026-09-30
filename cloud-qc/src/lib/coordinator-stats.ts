import "server-only";

import { db } from "@/lib/db";
import { hysteresisStatus } from "@/lib/neighbornet-status";
import type { ViewScope } from "@/lib/role-scope";

export type CoordinatorNnStat = {
  id: string;
  name: string;
  subArea: string | null;
  /** Rolled-up status across this NN's history — the same call the rest of
   *  the app uses, so a coordinator sees the figure everyone else sees. */
  status: string | null;
  lastVisitDate: Date | null;
  lastVisitBy: string | null;
  visitCount: number;
  /** Visits whose own status asked for a follow-up. */
  needsFollowup: number;
  /** Of this NN's visits, how many this particular person hasn't ticked. */
  unreviewed: number;
  food: number | null;
  leadership: number | null;
  halaqah: number | null;
};

export type CoordinatorStats = {
  nns: CoordinatorNnStat[];
  totals: {
    visitCount: number;
    unreviewed: number;
    needsFollowup: number;
    lastVisitDate: Date | null;
  };
};

function avg(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n != null);
  if (!v.length) return null;
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}

/**
 * Everything the coordinator dashboard shows, for whichever neighbornets
 * this person can see in full detail — one for a coordinator, a whole
 * sub-region for an SRC, and whatever their inviter has for core team.
 *
 * "Unreviewed" is per person (CoordinatorVisitReview), so a coordinator and
 * each of their core team work the same inbox without clearing it for one
 * another.
 */
export async function getCoordinatorStats(
  userId: string,
  scope: ViewScope,
): Promise<CoordinatorStats> {
  const nns = await db.neighbornet.findMany({
    where: {
      archivedAt: null,
      OR: [
        { id: { in: scope.fullNeighbornetIds } },
        ...(scope.fullSubregions.length
          ? [{ subArea: { in: scope.fullSubregions } }]
          : []),
      ],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      subArea: true,
      visitLinks: {
        where: { visit: { deletedAt: null } },
        orderBy: { visit: { visitDate: "desc" } },
        select: {
          visit: {
            select: {
              id: true,
              visitDate: true,
              status: true,
              foodRating: true,
              leadershipRating: true,
              halaqahRating: true,
              submittedBy: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });

  // One lookup of everything this person has already ticked off, rather
  // than a query per neighbornet.
  const visitIds = nns.flatMap((n) => n.visitLinks.map((l) => l.visit.id));
  const reviewed = visitIds.length
    ? new Set(
        (
          await db.coordinatorVisitReview.findMany({
            where: { userId, visitId: { in: visitIds } },
            select: { visitId: true },
          })
        ).map((r) => r.visitId),
      )
    : new Set<string>();

  const out: CoordinatorNnStat[] = nns.map((n) => {
    // visitLinks come back newest-first; hysteresisStatus wants oldest-first.
    const visits = n.visitLinks.map((l) => l.visit);
    const chronological = [...visits].reverse();
    const latest = visits[0] ?? null;

    return {
      id: n.id,
      name: n.name,
      subArea: n.subArea,
      status: hysteresisStatus(chronological),
      lastVisitDate: latest?.visitDate ?? null,
      lastVisitBy: latest
        ? (latest.submittedBy.name ?? latest.submittedBy.email ?? null)
        : null,
      visitCount: visits.length,
      needsFollowup: visits.filter(
        (v) => v.status === "NEEDS_FOLLOWUP" || v.status === "URGENT",
      ).length,
      unreviewed: visits.filter((v) => !reviewed.has(v.id)).length,
      food: avg(visits.map((v) => v.foodRating)),
      leadership: avg(visits.map((v) => v.leadershipRating)),
      halaqah: avg(visits.map((v) => v.halaqahRating)),
    };
  });

  // A joint event touching two of these neighbornets is one visit, so the
  // totals de-duplicate by visit id rather than summing the per-NN counts.
  const seen = new Set<string>();
  let visitCount = 0;
  let unreviewed = 0;
  let needsFollowup = 0;
  let lastVisitDate: Date | null = null;
  for (const n of nns) {
    for (const { visit: v } of n.visitLinks) {
      if (seen.has(v.id)) continue;
      seen.add(v.id);
      visitCount++;
      if (!reviewed.has(v.id)) unreviewed++;
      if (v.status === "NEEDS_FOLLOWUP" || v.status === "URGENT") needsFollowup++;
      if (!lastVisitDate || v.visitDate > lastVisitDate) lastVisitDate = v.visitDate;
    }
  }

  return { nns: out, totals: { visitCount, unreviewed, needsFollowup, lastVisitDate } };
}
