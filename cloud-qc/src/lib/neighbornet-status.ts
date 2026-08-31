import type { VisitStatusValue } from "@/lib/visit-schema";

/**
 * Displayed neighbornet status — a hysteresis roll-up over its visit history.
 *
 * Pure and live-computed (never stored):
 *   1. Keep only visits that have a status.
 *   2. Group by calendar date; each day's status is the *worst* (highest
 *      severity) among that day's visits.
 *   3. Walk the daily statuses in chronological order:
 *        - the first day sets the baseline
 *        - each later day jumps straight to its severity if that is >= the
 *          currently-displayed severity
 *        - otherwise the displayed severity steps *down by exactly one level*
 *   Returns `null` when there are no rated visits.
 */

const SEVERITY: Record<VisitStatusValue, number> = {
  ON_TRACK: 0,
  NEEDS_FOLLOWUP: 1,
  URGENT: 2,
};

const BY_SEVERITY: readonly VisitStatusValue[] = [
  "ON_TRACK",
  "NEEDS_FOLLOWUP",
  "URGENT",
];

export type StatusVisit = {
  visitDate: Date | string;
  status: string | null;
};

function isRated(s: string | null): s is VisitStatusValue {
  return s === "ON_TRACK" || s === "NEEDS_FOLLOWUP" || s === "URGENT";
}

function dayKey(d: Date | string): string {
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function hysteresisStatus(
  visits: readonly StatusVisit[],
): VisitStatusValue | null {
  // 1. rated visits only
  const rated = visits.filter((v) => isRated(v.status));
  if (rated.length === 0) return null;

  // 2. worst severity per calendar date
  const worstByDay = new Map<string, number>();
  for (const v of rated) {
    const key = dayKey(v.visitDate);
    const sev = SEVERITY[v.status as VisitStatusValue];
    const current = worstByDay.get(key);
    if (current === undefined || sev > current) worstByDay.set(key, sev);
  }

  // 3. chronological list of daily severities
  const daily = [...worstByDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, sev]) => sev);

  // 4. step logic — baseline, then jump-up-immediately / step-down-by-one
  let displayed = daily[0];
  for (let i = 1; i < daily.length; i++) {
    const today = daily[i];
    displayed = today >= displayed ? today : displayed - 1;
  }

  return BY_SEVERITY[displayed];
}

/** True when the displayed status warrants attention. */
export function needsFollowup(status: VisitStatusValue | null): boolean {
  return status === "NEEDS_FOLLOWUP" || status === "URGENT";
}
