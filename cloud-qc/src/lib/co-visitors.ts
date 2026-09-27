/** Who the feedback form offers when you're naming who else was there.
 *  Pure so it can be tested directly — the form just renders the result. */

export type CoVisitorOption = {
  id: string;
  label: string;
  /** The member's own home sub-region, if they've set one. */
  subArea?: string | null;
};

/** Never offer more than this at once: it's a glance-and-tap shortlist, not
 *  the whole roster. Anything past it is a search away. */
export const CO_SUGGESTION_LIMIT = 10;

/** Matches a member by first name, last name, or any run of characters in
 *  either — so "elfar", "omar", and "om el" all find "Omar Elfar". */
export function matchesName(label: string, query: string): boolean {
  const hay = label.toLowerCase();
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (hay.includes(q)) return true;
  const words = hay.split(/\s+/).filter(Boolean);
  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => words.some((w) => w.startsWith(tok)));
}

/**
 * The co-visitor shortlist, in priority order:
 *   1. the last few people this user actually logged a visit with (already
 *      ordered most-recent-first by the caller),
 *   2. then members whose own home sub-region matches theirs,
 *   3. then everyone else, in whatever order `members` came in (the server
 *      sorts by name, so: alphabetical).
 *
 * Anyone already added is dropped, the whole thing is filtered by `query`,
 * and the result is capped at `limit`. Steps 1 and 2 can each come up short
 * — one recent partner, or a member base that hasn't set home sub-regions —
 * and the next step simply fills the remaining slots.
 */
export function buildCoSuggestions({
  members,
  recentIds,
  homeSubArea,
  taken,
  query = "",
  limit = CO_SUGGESTION_LIMIT,
}: {
  members: CoVisitorOption[];
  recentIds: string[];
  homeSubArea?: string | null;
  taken: string[];
  query?: string;
  limit?: number;
}): CoVisitorOption[] {
  const takenSet = new Set(taken);
  const byId = new Map(members.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const out: CoVisitorOption[] = [];

  const push = (m: CoVisitorOption | undefined) => {
    if (!m || takenSet.has(m.id) || seen.has(m.id)) return;
    if (!matchesName(m.label, query)) return;
    seen.add(m.id);
    out.push(m);
  };

  for (const id of recentIds) push(byId.get(id));
  if (homeSubArea) {
    for (const m of members) if (m.subArea === homeSubArea) push(m);
  }
  for (const m of members) push(m);

  return out.slice(0, limit);
}
