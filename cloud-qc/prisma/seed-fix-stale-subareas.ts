/**
 * Repairs user profile fields left pointing at sub-area names that the Sep
 * 2026 directory update renamed (see seed-directory-2026-09.ts). That pass
 * renamed Neighbornet.subArea values but never migrated the two places a
 * user's own sub-area is stored by name rather than by id:
 *   - User.homeSubArea   (drives the dashboard/feedback-form defaults)
 *   - User.digestSubAreas (drives which areas their digest email covers)
 *
 * Left unfixed, those users had a "home" that matched no live sub-area, so
 * every home-scoped default silently fell back to "no area" — which is how
 * a member ends up unable to find their own neighbornet on the dashboard.
 *
 * Only "North New Jersey" turned out to be in use; the other renames
 * (South New Jersey, East/West New York, Illinois) never made it into
 * profile data. Unknown-but-still-valid names are left alone.
 *
 * Idempotent — safe to re-run.
 */
import { db } from "@/lib/db";

const RENAMES: Record<string, string> = {
  "North New Jersey": "NJ North",
  "South New Jersey": "NJ South", // split into NJ South / NJ Central; South is the closer match
  "West New York": "New York West",
  "East New York": "New York East",
};

async function main() {
  const users = await db.user.findMany({
    select: { id: true, name: true, email: true, homeSubArea: true, digestSubAreas: true },
  });

  let homesFixed = 0;
  let digestsFixed = 0;

  for (const u of users) {
    const newHome = u.homeSubArea ? RENAMES[u.homeSubArea] : undefined;
    const newDigest = u.digestSubAreas.map((d) => RENAMES[d] ?? d);
    const digestChanged =
      newDigest.length !== u.digestSubAreas.length ||
      newDigest.some((d, i) => d !== u.digestSubAreas[i]);

    if (!newHome && !digestChanged) continue;

    await db.user.update({
      where: { id: u.id },
      data: {
        ...(newHome ? { homeSubArea: newHome } : {}),
        // De-duplicate: a rename can collide with an area they already had.
        ...(digestChanged ? { digestSubAreas: [...new Set(newDigest)] } : {}),
      },
    });
    if (newHome) {
      homesFixed++;
      console.log(`✓ ${u.name ?? u.email}: home "${u.homeSubArea}" -> "${newHome}"`);
    }
    if (digestChanged) {
      digestsFixed++;
      console.log(`✓ ${u.name ?? u.email}: digest areas -> [${[...new Set(newDigest)].join(", ")}]`);
    }
  }

  console.log(`\n✓ ${homesFixed} home sub-areas and ${digestsFixed} digest lists repaired.`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
