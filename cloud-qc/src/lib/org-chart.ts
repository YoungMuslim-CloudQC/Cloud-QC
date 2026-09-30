import "server-only";

import { db } from "@/lib/db";
import { memberName } from "@/lib/queries";

export type OrgPerson = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  pending: boolean;
};

export type OrgCoordinator = OrgPerson & {
  neighbornetId: string;
  neighbornetName: string;
  /** More than one holder means a handoff is in progress. */
  handingOver: boolean;
  coreTeam: OrgPerson[];
};

export type OrgSubregion = {
  subArea: string;
  region: string;
  srCoordinators: (OrgPerson & { coreTeam: OrgPerson[] })[];
  coordinators: OrgCoordinator[];
  /** Neighbornets here with nobody looking after them. */
  uncovered: string[];
};

export type OrgChart = {
  subregions: OrgSubregion[];
  cloudTeam: (OrgPerson & { isAdmin: boolean; visitCount: number })[];
};

/**
 * Who looks after what, across the whole org — sub-region, its SR
 * coordinator, each neighbornet's coordinator, and the core teams under
 * both. Plus the Cloud QC team itself.
 *
 * Read-only and unscoped on purpose: this is the internal directory, so
 * everyone sees the same structure. It deliberately carries no feedback,
 * only who's who.
 */
export async function getOrgChart(): Promise<OrgChart> {
  const [assignments, neighbornets, members, participantRows] = await Promise.all([
    db.userRoleAssignment.findMany({
      select: {
        roleType: true,
        scopeSubregion: true,
        transitionEndsAt: true,
        inheritsFromUserId: true,
        scopeNeighbornet: { select: { id: true, name: true, subArea: true, region: true } },
        user: {
          select: { id: true, name: true, email: true, image: true, status: true },
        },
      },
    }),
    db.neighbornet.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, subArea: true, region: true },
    }),
    db.user.findMany({
      where: { status: "APPROVED", roleAssignments: { none: {} } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, image: true, role: true },
    }),
    db.visitParticipant.groupBy({
      by: ["userId"],
      where: { visit: { deletedAt: null } },
      _count: { _all: true },
    }),
  ]);

  const person = (u: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
    status: string;
  }): OrgPerson => ({
    id: u.id,
    name: memberName(u),
    email: u.email,
    image: u.image,
    pending: u.status !== "APPROVED",
  });

  // Core team seats, grouped by who they inherit from.
  const coreByBoss = new Map<string, OrgPerson[]>();
  for (const a of assignments) {
    if (a.roleType !== "CORE_TEAM" || !a.inheritsFromUserId) continue;
    const list = coreByBoss.get(a.inheritsFromUserId) ?? [];
    list.push(person(a.user));
    coreByBoss.set(a.inheritsFromUserId, list);
  }

  // Coordinators, grouped by the sub-region their neighbornet sits in.
  const coordsBySub = new Map<string, OrgCoordinator[]>();
  const holdersPerNn = new Map<string, number>();
  for (const a of assignments) {
    if (a.roleType !== "COORDINATOR" || !a.scopeNeighbornet) continue;
    holdersPerNn.set(
      a.scopeNeighbornet.id,
      (holdersPerNn.get(a.scopeNeighbornet.id) ?? 0) + 1,
    );
  }
  for (const a of assignments) {
    if (a.roleType !== "COORDINATOR" || !a.scopeNeighbornet) continue;
    const nn = a.scopeNeighbornet;
    const key = nn.subArea ?? "Unassigned";
    const list = coordsBySub.get(key) ?? [];
    list.push({
      ...person(a.user),
      neighbornetId: nn.id,
      neighbornetName: nn.name,
      handingOver: (holdersPerNn.get(nn.id) ?? 0) > 1,
      coreTeam: coreByBoss.get(a.user.id) ?? [],
    });
    coordsBySub.set(key, list);
  }

  const srcsBySub = new Map<string, (OrgPerson & { coreTeam: OrgPerson[] })[]>();
  for (const a of assignments) {
    if (a.roleType !== "SR_COORDINATOR" || !a.scopeSubregion) continue;
    const list = srcsBySub.get(a.scopeSubregion) ?? [];
    list.push({ ...person(a.user), coreTeam: coreByBoss.get(a.user.id) ?? [] });
    srcsBySub.set(a.scopeSubregion, list);
  }

  // Every sub-region that exists, whether or not anyone runs it — an empty
  // one is exactly the thing this page should make obvious.
  const regionOf = new Map<string, string>();
  const nnsBySub = new Map<string, { id: string; name: string }[]>();
  for (const n of neighbornets) {
    const key = n.subArea ?? "Unassigned";
    regionOf.set(key, n.region);
    nnsBySub.set(key, [...(nnsBySub.get(key) ?? []), { id: n.id, name: n.name }]);
  }

  const subregions: OrgSubregion[] = [...nnsBySub.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((subArea) => {
      const coordinators = (coordsBySub.get(subArea) ?? []).sort((a, b) =>
        a.neighbornetName.localeCompare(b.neighbornetName),
      );
      const covered = new Set(coordinators.map((c) => c.neighbornetId));
      return {
        subArea,
        region: regionOf.get(subArea) ?? "",
        srCoordinators: srcsBySub.get(subArea) ?? [],
        coordinators,
        uncovered: (nnsBySub.get(subArea) ?? [])
          .filter((n) => !covered.has(n.id))
          .map((n) => n.name),
      };
    });

  const visitsByUser = new Map(participantRows.map((r) => [r.userId, r._count._all]));

  return {
    subregions,
    cloudTeam: members.map((m) => ({
      id: m.id,
      name: memberName(m),
      email: m.email,
      image: m.image,
      pending: false,
      isAdmin: m.role === "ADMIN",
      visitCount: visitsByUser.get(m.id) ?? 0,
    })),
  };
}
