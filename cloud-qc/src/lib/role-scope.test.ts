import { describe, expect, it } from "vitest";

import {
  canSeeFullDetail,
  canSeeRollup,
  resolveViewScope,
  type RoleAssignmentRecord,
} from "@/lib/role-scope";

function byUser(...rows: RoleAssignmentRecord[]) {
  const m = new Map<string, RoleAssignmentRecord[]>();
  for (const r of rows) m.set(r.userId, [...(m.get(r.userId) ?? []), r]);
  return m;
}

const coordinator = (userId: string, nn: string): RoleAssignmentRecord => ({
  userId,
  roleType: "COORDINATOR",
  scopeNeighbornetId: nn,
});
const src = (userId: string, sub: string): RoleAssignmentRecord => ({
  userId,
  roleType: "SR_COORDINATOR",
  scopeSubregion: sub,
});
const coreTeam = (userId: string, under: string): RoleAssignmentRecord => ({
  userId,
  roleType: "CORE_TEAM",
  inheritsFromUserId: under,
});

describe("resolveViewScope", () => {
  it("gives someone with no assignments nothing, and leaves them able to submit", () => {
    const scope = resolveViewScope("u1", byUser());
    expect(scope).toEqual({
      viewOnly: false,
      fullNeighbornetIds: [],
      fullSubregions: [],
      nationalRollup: false,
    });
  });

  it("scopes a coordinator to their one neighbornet, with no national rollup", () => {
    const scope = resolveViewScope("u1", byUser(coordinator("u1", "nn-teaneck")));
    expect(scope.fullNeighbornetIds).toEqual(["nn-teaneck"]);
    expect(scope.fullSubregions).toEqual([]);
    expect(scope.nationalRollup).toBe(false);
    expect(scope.viewOnly).toBe(true);
  });

  it("gives an SR coordinator their whole sub-region plus the national rollup", () => {
    const scope = resolveViewScope("u1", byUser(src("u1", "NJ North")));
    expect(scope.fullSubregions).toEqual(["NJ North"]);
    expect(scope.nationalRollup).toBe(true);
    expect(scope.viewOnly).toBe(true);
  });

  it("gives a core-team member exactly their coordinator's scope", () => {
    const scope = resolveViewScope(
      "helper",
      byUser(coordinator("boss", "nn-teaneck"), coreTeam("helper", "boss")),
    );
    expect(scope.fullNeighbornetIds).toEqual(["nn-teaneck"]);
    expect(scope.nationalRollup).toBe(false);
    expect(scope.viewOnly).toBe(true);
  });

  it("passes the national rollup down to an SRC's core team", () => {
    const scope = resolveViewScope(
      "helper",
      byUser(src("boss", "Dallas"), coreTeam("helper", "boss")),
    );
    expect(scope.fullSubregions).toEqual(["Dallas"]);
    expect(scope.nationalRollup).toBe(true);
  });

  it("resolves a chain: core team of someone who is themselves core team", () => {
    // Exactly what a finished handoff leaves behind: `outgoing` was the
    // coordinator, is now core team under `incoming`, and still has their
    // own core team pointing at them.
    const scope = resolveViewScope(
      "helper",
      byUser(
        coordinator("incoming", "nn-teaneck"),
        coreTeam("outgoing", "incoming"),
        coreTeam("helper", "outgoing"),
      ),
    );
    expect(scope.fullNeighbornetIds).toEqual(["nn-teaneck"]);
  });

  it("does not hang on a cycle", () => {
    const scope = resolveViewScope(
      "a",
      byUser(coreTeam("a", "b"), coreTeam("b", "a")),
    );
    expect(scope.fullNeighbornetIds).toEqual([]);
    expect(scope.viewOnly).toBe(true);
  });

  it("unions several seats held by one person", () => {
    const scope = resolveViewScope(
      "u1",
      byUser(coordinator("u1", "nn-a"), coreTeam("u1", "boss"), src("boss", "Dallas")),
    );
    expect(scope.fullNeighbornetIds).toEqual(["nn-a"]);
    expect(scope.fullSubregions).toEqual(["Dallas"]);
    expect(scope.nationalRollup).toBe(true);
  });

  it("treats both coordinators as full holders during a handoff window", () => {
    const rows = byUser(
      coordinator("outgoing", "nn-teaneck"),
      coordinator("incoming", "nn-teaneck"),
    );
    expect(resolveViewScope("outgoing", rows).fullNeighbornetIds).toEqual([
      "nn-teaneck",
    ]);
    expect(resolveViewScope("incoming", rows).fullNeighbornetIds).toEqual([
      "nn-teaneck",
    ]);
  });

  it("does not mark someone view-only just for being inherited from", () => {
    // `boss` holds a real seat; that's why they're view-only — but the walk
    // must not count the *inherited* rows toward the helper's own tally in a
    // way that changes the boss's answer.
    const rows = byUser(coordinator("boss", "nn-a"), coreTeam("helper", "boss"));
    expect(resolveViewScope("boss", rows).viewOnly).toBe(true);
    expect(resolveViewScope("helper", rows).viewOnly).toBe(true);
  });
});

describe("canSeeFullDetail / canSeeRollup", () => {
  const coordScope = resolveViewScope("u1", byUser(coordinator("u1", "nn-a")));
  const srcScope = resolveViewScope("u2", byUser(src("u2", "NJ North")));

  it("lets a coordinator see their own NN in full", () => {
    expect(canSeeFullDetail(coordScope, { id: "nn-a", subArea: "NJ North" })).toBe(true);
  });

  it("blocks a coordinator from any other NN, rollup included", () => {
    const other = { id: "nn-b", subArea: "NJ North" };
    expect(canSeeFullDetail(coordScope, other)).toBe(false);
    expect(canSeeRollup(coordScope, other)).toBe(false);
  });

  it("lets an SRC see every NN in their sub-region in full", () => {
    expect(canSeeFullDetail(srcScope, { id: "nn-x", subArea: "NJ North" })).toBe(true);
  });

  it("gives an SRC rollup-only on NNs outside their sub-region", () => {
    const far = { id: "nn-y", subArea: "Dallas" };
    expect(canSeeFullDetail(srcScope, far)).toBe(false);
    expect(canSeeRollup(srcScope, far)).toBe(true);
  });

  it("handles a neighbornet with no sub-region set", () => {
    expect(canSeeFullDetail(srcScope, { id: "nn-z", subArea: null })).toBe(false);
    expect(canSeeRollup(srcScope, { id: "nn-z", subArea: null })).toBe(true);
  });
});
