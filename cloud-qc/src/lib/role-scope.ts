/** Turns a set of UserRoleAssignment rows into "what can this person see?".
 *
 *  Pure and synchronous so the access matrix is testable on its own — the
 *  server wrapper (lib/role-access.ts) does the loading and hands the rows in.
 */

export type RoleTypeValue = "COORDINATOR" | "SR_COORDINATOR" | "CORE_TEAM";

export type RoleAssignmentRecord = {
  userId: string;
  roleType: RoleTypeValue;
  /** COORDINATOR only. */
  scopeNeighbornetId?: string | null;
  /** SR_COORDINATOR only. */
  scopeSubregion?: string | null;
  /** CORE_TEAM only — whose scope this seat borrows. */
  inheritsFromUserId?: string | null;
};

export type ViewScope = {
  /** Holds at least one coordinator-side assignment. Such an account is
   *  view-only: it can read feedback but never submit, edit or send it,
   *  regardless of also being a MEMBER. */
  viewOnly: boolean;
  /** Neighbornets visible in full detail — feedback text, per-person
   *  ratings, the lot. */
  fullNeighbornetIds: string[];
  /** Sub-regions where *every* neighbornet is visible in full detail. */
  fullSubregions: string[];
  /** Whether they get the national per-neighbornet rollup: status and
   *  averaged ratings for every NN anywhere, never the written feedback.
   *  SR coordinators only (and their core teams, by inheritance). */
  nationalRollup: boolean;
};

export const EMPTY_SCOPE: ViewScope = {
  viewOnly: false,
  fullNeighbornetIds: [],
  fullSubregions: [],
  nationalRollup: false,
};

/** A core-team seat can point at someone who themselves holds only a
 *  core-team seat — most often right after a coordinator handoff, when the
 *  outgoing coordinator is re-seated on the new coordinator's core team and
 *  their own core team is still pointing at them. Walking up resolves that
 *  to the real scope instead of dead-ending. Capped so a cycle (or a silly
 *  chain) can't spin. */
const MAX_INHERIT_DEPTH = 5;

export function resolveViewScope(
  userId: string,
  assignmentsByUser: Map<string, RoleAssignmentRecord[]>,
): ViewScope {
  const fullNeighbornetIds = new Set<string>();
  const fullSubregions = new Set<string>();
  let nationalRollup = false;
  let held = 0;

  const visited = new Set<string>();

  const walk = (uid: string, depth: number) => {
    if (depth > MAX_INHERIT_DEPTH || visited.has(uid)) return;
    visited.add(uid);

    for (const a of assignmentsByUser.get(uid) ?? []) {
      if (uid === userId) held++;

      if (a.roleType === "COORDINATOR") {
        if (a.scopeNeighbornetId) fullNeighbornetIds.add(a.scopeNeighbornetId);
      } else if (a.roleType === "SR_COORDINATOR") {
        if (a.scopeSubregion) fullSubregions.add(a.scopeSubregion);
        // The national rollup is what makes an SRC different from a
        // coordinator: they answer for their sub-region but can see how
        // every other one is doing.
        nationalRollup = true;
      } else if (a.roleType === "CORE_TEAM") {
        if (a.inheritsFromUserId) walk(a.inheritsFromUserId, depth + 1);
      }
    }
  };

  walk(userId, 0);

  return {
    viewOnly: held > 0,
    fullNeighbornetIds: [...fullNeighbornetIds].sort(),
    fullSubregions: [...fullSubregions].sort(),
    nationalRollup,
  };
}

/** Can this person see everything about this neighbornet — the written
 *  feedback included? Admins bypass this entirely. */
export function canSeeFullDetail(
  scope: ViewScope,
  nn: { id: string; subArea?: string | null },
): boolean {
  if (scope.fullNeighbornetIds.includes(nn.id)) return true;
  return Boolean(nn.subArea && scope.fullSubregions.includes(nn.subArea));
}

/** Can this person see *anything* about this neighbornet — full detail, or
 *  just its rolled-up status and rating averages? */
export function canSeeRollup(
  scope: ViewScope,
  nn: { id: string; subArea?: string | null },
): boolean {
  return scope.nationalRollup || canSeeFullDetail(scope, nn);
}
