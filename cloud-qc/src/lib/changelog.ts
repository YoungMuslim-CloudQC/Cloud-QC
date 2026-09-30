/**
 * What's new, in the order it shipped — newest first.
 *
 * Hand-written on purpose. A commit hash or a deploy timestamp would tell a
 * QC member nothing; this is the list of things they'd actually notice, in
 * their words rather than the code's. Add an entry when a release changes
 * something someone will see, and skip the ones that don't (a refactor, a
 * dependency bump, a fix nobody hit).
 *
 * `id` must be unique and must never be reused — it's what gets stored on
 * User.lastSeenChangelog to decide whether to announce anything.
 */

export type ReleaseNote = {
  id: string;
  date: string;
  title: string;
  /** Who it's for. Everyone sees every note; this just sets the label. */
  audience?: "Coordinators" | "Admins" | "Everyone";
  items: string[];
};

export const CHANGELOG: ReleaseNote[] = [
  {
    id: "2026-09-29-coordinators",
    date: "2026-09-29",
    title: "Coordinators, core teams and the org map",
    audience: "Everyone",
    items: [
      "Neighbornet coordinators can now sign in to their own view: how their NN is doing, and every piece of QC feedback about it.",
      "SR coordinators get the same, across their whole sub-region, plus a national picture of how every other sub-region is doing.",
      "Coordinators can build a core team — anyone they invite sees exactly what they see.",
      "New Org map: who looks after which neighbornet, who runs each sub-region, and who's on whose team. Click anyone for their details.",
      "Admins can now view the app as any coordinator, to see exactly what they see.",
    ],
  },
  {
    id: "2026-09-28-error-pages",
    date: "2026-09-28",
    title: "Friendlier error pages",
    audience: "Everyone",
    items: [
      "If a page ever fails to load you now get a proper Cloud QC page with a way back, instead of a blank browser error.",
      "There's a pixel character on it. He turns up in a different outfit every time.",
    ],
  },
  {
    id: "2026-09-27-feedback-form",
    date: "2026-09-27",
    title: "A faster feedback form and a shorter dashboard",
    audience: "Everyone",
    items: [
      "What you're logging and the date are now proper questions rather than pre-filled guesses — no more visits quietly saved with today's date.",
      "Naming who came with you is now a search that puts the people you actually went out with last at the top.",
      "The dashboard opens on your own sub-region instead of all 126 neighbornets, so it's about five screens instead of thirty-five.",
    ],
  },
  {
    id: "2026-09-24-directory",
    date: "2026-09-24",
    title: "The full national directory",
    audience: "Everyone",
    items: [
      "Every neighbornet across the country is now in Cloud QC — 30 new ones, and New Jersey split into North, Central and South.",
      "Expansions (SRs still in training) are tracked too, with their own filter.",
      "57 neighbornets that were missing a map pin now have one.",
    ],
  },
  {
    id: "2026-09-23-export",
    date: "2026-09-23",
    title: "Export feedback as a spreadsheet",
    audience: "Everyone",
    items: [
      "Any QC member can now export feedback as a CSV — everything, one sub-region, or a single neighbornet.",
    ],
  },
];

export const LATEST_RELEASE = CHANGELOG[0];

/** Whether this person has anything to be told about. A brand-new account
 *  (null) is deliberately treated as caught up: someone signing in for the
 *  first time doesn't want a changelog, they want the app. */
export function hasUnseenRelease(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return lastSeen !== LATEST_RELEASE.id;
}
