import "server-only";

import { db } from "@/lib/db";
import { getSettings, getTeamMemberStats, type MemberStat } from "@/lib/queries";

/** Someone with no logged visit in this long is worth a nudge. Not a
 *  judgement — a lead asked to see who's gone quiet, and a bare date makes
 *  you do the arithmetic yourself. */
export const QUIET_DAYS = 30;

export type CloudTeamOverview = {
  members: (MemberStat & { quietFor: number | null })[];
  active: number;
  quiet: number;
  visitsThisMonth: number;
  visitsAllTime: number;
};

/**
 * What a Cloud Lead sees about the QC team. Lives here rather than in the
 * page because it needs the clock, and reading the clock while rendering
 * makes a component's output depend on when it ran.
 */
export async function getCloudTeamOverview(): Promise<CloudTeamOverview> {
  const now = Date.now();
  const monthAgo = new Date(now - 30 * 86_400_000);

  const [members, settings, participantCount, visitsThisMonth] = await Promise.all([
    getTeamMemberStats(),
    getSettings(),
    db.visitParticipant.count({ where: { visit: { deletedAt: null } } }),
    db.visit.count({ where: { deletedAt: null, visitDate: { gte: monthAgo } } }),
  ]);

  const withActivity = members.map((m) => ({
    ...m,
    quietFor: m.lastVisit
      ? Math.floor((now - m.lastVisit.getTime()) / 86_400_000)
      : null,
  }));

  return {
    members: withActivity,
    active: withActivity.filter((m) => m.quietFor !== null && m.quietFor <= QUIET_DAYS)
      .length,
    quiet: withActivity.filter((m) => m.quietFor === null || m.quietFor > QUIET_DAYS)
      .length,
    visitsThisMonth,
    visitsAllTime: Math.max(0, participantCount + settings.manualOffset),
  };
}
