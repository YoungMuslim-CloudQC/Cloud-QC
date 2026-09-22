import { isoDate } from "@/lib/format";

/** Full copy of a visit's state at a moment in time — stored as JSON on each
 *  VisitHistory row. Names are denormalized so the timeline renders even if a
 *  user or neighbornet is later renamed. */
export type VisitSnapshot = {
  neighbornetNames: string[]; // empty for an SR/Bash event
  subRegion?: string | null; // SR/Bash events only
  /** @deprecated singular — present only on snapshots taken before a visit
   *  could span multiple neighbornets. Read neighbornetNames instead. */
  neighbornetName?: string;
  visitDate: string; // YYYY-MM-DD
  eventType?: string; // absent on snapshots taken before event types existed
  groupSize: number | null;
  avgAge: number | null;
  foodRating: number | null;
  leadershipRating: number | null;
  halaqahRating: number | null;
  status: string | null;
  notes: string;
  feedbackSent: boolean;
  submittedById: string;
  submittedByName: string;
  coVisitors: { userId: string; name: string }[];
};

type Named = { name?: string | null; email?: string | null };
const nameOf = (u: Named) => u.name || u.email || "Member";

export type VisitForSnapshot = {
  neighbornets: { neighbornet: { name: string } }[];
  subRegion?: string | null;
  eventType?: string;
  visitDate: Date | string;
  groupSize: number | null;
  avgAge: number | null;
  foodRating: number | null;
  leadershipRating: number | null;
  halaqahRating: number | null;
  status: string | null;
  notes: string;
  feedbackSent: boolean;
  submittedById: string;
  submittedBy: Named;
  participants: {
    role: "SUBMITTER" | "CO_VISITOR";
    userId: string;
    user: Named;
  }[];
};

export function buildVisitSnapshot(visit: VisitForSnapshot): VisitSnapshot {
  return {
    neighbornetNames: visit.neighbornets.map((l) => l.neighbornet.name),
    subRegion: visit.subRegion,
    visitDate: isoDate(visit.visitDate),
    eventType: visit.eventType,
    groupSize: visit.groupSize,
    avgAge: visit.avgAge,
    foodRating: visit.foodRating,
    leadershipRating: visit.leadershipRating,
    halaqahRating: visit.halaqahRating,
    status: visit.status,
    notes: visit.notes,
    feedbackSent: visit.feedbackSent,
    submittedById: visit.submittedById,
    submittedByName: nameOf(visit.submittedBy),
    coVisitors: visit.participants
      .filter((p) => p.role === "CO_VISITOR")
      .map((p) => ({ userId: p.userId, name: nameOf(p.user) })),
  };
}

export const VISIT_SNAPSHOT_INCLUDE = {
  neighbornets: { include: { neighbornet: { select: { name: true } } } },
  submittedBy: { select: { name: true, email: true } },
  participants: { include: { user: { select: { name: true, email: true } } } },
} as const;

export const HISTORY_ACTION_META: Record<
  string,
  { label: string; cls: string }
> = {
  CREATED: { label: "Created", cls: "badge-success" },
  EDITED: { label: "Edited", cls: "badge-warn" },
  DELETED: { label: "Deleted", cls: "badge-urgent" },
  RESTORED: { label: "Restored", cls: "badge-neutral" },
};
