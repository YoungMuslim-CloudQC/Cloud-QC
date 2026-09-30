import "server-only";

import type { RoleType } from "@prisma/client";

import { db } from "@/lib/db";
import {
  EMPTY_SCOPE,
  resolveViewScope,
  type RoleAssignmentRecord,
  type ViewScope,
} from "@/lib/role-scope";

/** Prisma `where` fragment for "someone who does QC work" — everyone except
 *  the view-only seats, who are left out of the roster, the leaderboard,
 *  rotation, digests and the co-visitor picker.
 *
 *  Checks the seat *types* rather than "holds any seat", because a Cloud
 *  Lead holds one and is still very much a QC member: a blanket `none: {}`
 *  would quietly drop them off the team page and out of everyone's
 *  co-visitor list the moment they were made a lead. */
export const QC_MEMBER_WHERE = {
  roleAssignments: {
    none: {
      roleType: {
        in: ["COORDINATOR", "SR_COORDINATOR", "CORE_TEAM"] as RoleType[],
      },
    },
  },
};

/**
 * What this user can see, resolved from their role assignments (plus anyone
 * they inherit from on a core team).
 *
 * Loads the assignments of the user *and* of everyone reachable through a
 * core-team chain, then hands the lot to the pure resolver. The chain is
 * short in practice — a core-team seat points at a coordinator, and the one
 * longer case is a finished handoff — so this stays at a couple of queries.
 */
export async function getViewScope(userId: string): Promise<ViewScope> {
  const own = await db.userRoleAssignment.findMany({
    where: { userId },
    select: {
      userId: true,
      roleType: true,
      scopeNeighbornetId: true,
      scopeSubregion: true,
      inheritsFromUserId: true,
    },
  });
  if (own.length === 0) return EMPTY_SCOPE;

  const rows: RoleAssignmentRecord[] = [...own];
  const loaded = new Set<string>([userId]);
  let frontier = own
    .map((a) => a.inheritsFromUserId)
    .filter((id): id is string => Boolean(id) && !loaded.has(id!));

  // Follow core-team inheritance outward. Bounded by the same depth the
  // resolver honours, so a cycle can't turn this into an endless walk.
  for (let depth = 0; depth < 5 && frontier.length > 0; depth++) {
    frontier.forEach((id) => loaded.add(id));
    const next = await db.userRoleAssignment.findMany({
      where: { userId: { in: frontier } },
      select: {
        userId: true,
        roleType: true,
        scopeNeighbornetId: true,
        scopeSubregion: true,
        inheritsFromUserId: true,
      },
    });
    rows.push(...next);
    frontier = next
      .map((a) => a.inheritsFromUserId)
      .filter((id): id is string => Boolean(id) && !loaded.has(id!));
  }

  const byUser = new Map<string, RoleAssignmentRecord[]>();
  for (const r of rows) {
    byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
  }
  return resolveViewScope(userId, byUser);
}

/** The neighbornets this scope can see in full detail, as a `where` fragment.
 *  Admins should skip this entirely rather than pass a scope. */
export function fullDetailNeighbornetWhere(scope: ViewScope) {
  return {
    OR: [
      { id: { in: scope.fullNeighbornetIds } },
      ...(scope.fullSubregions.length
        ? [{ subArea: { in: scope.fullSubregions } }]
        : []),
    ],
  };
}
