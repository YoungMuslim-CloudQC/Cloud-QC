import "server-only";

import { db } from "@/lib/db";
import { isoDate } from "@/lib/format";
import { hysteresisStatus } from "@/lib/neighbornet-status";
import { getViewScope } from "@/lib/role-access";
import type { DigestAttentionLine, DigestContent } from "@/lib/digest";

const SEVERITY: Record<string, number> = { URGENT: 2, NEEDS_FOLLOWUP: 1 };

/** Every coordinator email covers the same window regardless of how often
 *  it's sent: a trimester. Sent weekly, so it's a regular nudge that still
 *  carries the whole term each time, rather than a week's worth they'd have
 *  to stitch together themselves. */
export const TRIMESTER_DAYS = 91;

/**
 * A coordinator's digest, in the same shape the member digest uses so it
 * renders through the same `digestEmailHtml` — same layout, same styling,
 * one template to keep working.
 *
 * Two things differ from the member version, and both are why this couldn't
 * just call buildDigestContent: the scope comes from their role assignments
 * rather than the profile sub-area fields a coordinator never sets, and the
 * window is fixed at a trimester instead of following the send cadence.
 */
export async function buildCoordinatorDigestContent(
  userId: string,
): Promise<DigestContent> {
  const scope = await getViewScope(userId);

  const neighbornets = await db.neighbornet.findMany({
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
      // The credit-bearing link, same as the member digest: a Bash/SR event
      // never appears, and a joint event shows up once per neighbornet.
      visitLinks: {
        where: { visit: { deletedAt: null } },
        orderBy: { visit: { visitDate: "desc" } },
        select: {
          visit: { select: { id: true, visitDate: true, status: true, notes: true } },
        },
      },
    },
  });

  if (neighbornets.length === 0) {
    return {
      attention: [],
      onTrackNames: [],
      notVisitedNames: [],
      yourVisitCount: 0,
      periodLabel: "",
      // Reuses the member digest's "nothing to show you yet" email — for a
      // coordinator it means no neighbornet is linked rather than no region
      // picked, but the outcome and the fix (talk to an admin) are the same.
      noRegionSelected: true,
      subAreas: [],
      audience: "coordinator",
    };
  }

  const since = new Date(Date.now() - TRIMESTER_DAYS * 24 * 60 * 60 * 1000);

  const attention: DigestAttentionLine[] = [];
  const onTrackNames: string[] = [];
  const notVisitedNames: string[] = [];
  const countedVisits = new Set<string>();

  for (const n of neighbornets) {
    const visits = n.visitLinks.map((l) => l.visit);

    // De-duplicated by visit id, so a joint event touching two of their
    // neighbornets counts once rather than inflating the total.
    for (const v of visits) {
      if (v.visitDate >= since) countedVisits.add(v.id);
    }

    // Status is the live rolled-up picture, not bounded by the window —
    // a neighbornet that went quiet three months ago is still a problem
    // today, and hiding it because nothing happened recently would be
    // exactly backwards.
    const status = hysteresisStatus(visits);
    const latest = visits[0] ?? null;

    if (status === "NEEDS_FOLLOWUP" || status === "URGENT") {
      attention.push({
        id: n.id,
        name: n.name,
        status,
        lastVisitDate: latest ? isoDate(latest.visitDate) : null,
        lastVisitNote: latest?.notes ?? null,
      });
    } else if (status === "ON_TRACK") {
      onTrackNames.push(n.name);
    } else {
      notVisitedNames.push(n.name);
    }
  }
  attention.sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status]);

  return {
    attention,
    onTrackNames,
    notVisitedNames,
    yourVisitCount: countedVisits.size,
    periodLabel: "This trimester",
    noRegionSelected: false,
    subAreas: neighbornets.map((n) => n.name),
    audience: "coordinator",
  };
}
