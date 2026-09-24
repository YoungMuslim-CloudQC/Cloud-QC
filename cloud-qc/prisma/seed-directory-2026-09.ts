/**
 * Reconciles the live neighbornet directory against an updated national
 * list (Sep 2026): splits NJ's old North/South split into North/Central/
 * South, splits NY's East/West into cleaner names, adds a Chicago sub-area
 * under Illinois, adds a first Kentucky sub-area, and fills in a batch of
 * neighbornets missing from the old list. Idempotent — safe to re-run.
 *
 * Two names collide with an existing neighbornet in a different state; both
 * were confirmed with the org rather than guessed:
 *   - "Cstat" (Texas/Houston) is the same place as "College Station" in the
 *     new list — renamed in place, history preserved.
 *   - "Westport" already exists under Pennsylvania; the new Kentucky
 *     "Westport" is a *different*, real place — created as a separate NN,
 *     the PA one is left untouched.
 * Every existing neighbornet not mentioned in the new list (Flushing, Stone
 * Mountain, Waterbury, Cstat's Houston neighbors, the West Coast/Canada
 * entries, etc.) is intentionally left alone — absence from this list isn't
 * a delete instruction.
 *
 * Matching is scoped to (normalized name, region) rather than name alone,
 * so same-named places in different states (the Westchester/NY vs. West
 * Chester/PA pair) never cross-match.
 */
import { db } from "@/lib/db";

type Group = { region: string; stateCode: string; subArea: string; names: string[] };

const DATA: Group[] = [
  { region: "New Jersey", stateCode: "NJ", subArea: "NJ North", names: ["Teaneck", "Paramus", "Bayonne", "Jersey City", "Morris County", "Newark", "Wayne", "North Hudson"] },
  { region: "New Jersey", stateCode: "NJ", subArea: "NJ South", names: ["South Brunswick", "Montyboro", "South Jersey", "571", "Blackwood", "Voorhees"] },
  { region: "New Jersey", stateCode: "NJ", subArea: "NJ Central", names: ["Piscataway", "Edison", "Woodbridge", "Old Bridge"] },

  { region: "New York", stateCode: "NY", subArea: "New York West", names: ["Bronx", "Brooklyn", "Westchester", "Whiteplains"] },
  { region: "New York", stateCode: "NY", subArea: "New York East", names: ["Jamaica", "Valley Stream", "Shelter Rock", "East Meadow", "Ronkonkoma", "Melville", "Five Town"] },

  { region: "Georgia", stateCode: "GA", subArea: "Georgia", names: ["Atlanta", "Lilburn", "Suwanee", "Cumming"] },

  { region: "Texas", stateCode: "TX", subArea: "Houston", names: ["Mas Katy", "Maryam", "Clear Lake", "Cinco Ranch", "Bear Creek", "College Station", "Synott", "Cypress", "Pearland"] },
  { region: "Texas", stateCode: "TX", subArea: "Dallas", names: ["Carrollton", "Euless", "Irving", "Valley Ranch", "Frisco", "Richardson", "East Plano", "Colleyville", "Prosper", "Southlake", "75", "McKinney", "Wylie"] },

  { region: "Illinois", stateCode: "IL", subArea: "Chicago", names: ["Plainfield", "Niles", "Westside", "IFN", "Barrington", "Potter", "Boling Brook"] },

  { region: "Florida", stateCode: "FL", subArea: "Florida", names: ["Pompano", "Jacksonville", "South Florida", "Miami", "West Palm Beach", "Pembroke Pines", "Tampa", "Gainesville"] },

  { region: "Connecticut", stateCode: "CT", subArea: "Connecticut", names: ["YM Berlin", "YM Locks", "YM Stamford", "YM New Haven"] },

  { region: "Pennsylvania", stateCode: "PA", subArea: "Pennsylvania", names: ["West Philly", "Easton", "Devon", "Upper Darby", "Khair", "Westchester", "Pittsburgh", "Harrisburg"] },

  { region: "Kentucky", stateCode: "KY", subArea: "Kentucky", names: ["Westport", "Lexington", "4th Street"] },
];

function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/^ym[.\s]+/, "")
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });

  // Confirmed same place, different old name — rename in place so its visit
  // history carries over rather than creating a duplicate.
  const csRename = await db.neighbornet.updateMany({
    where: { name: "Cstat" },
    data: { name: "College Station" },
  });
  if (csRename.count > 0) console.log('✓ renamed "Cstat" → "College Station"');

  const existing = await db.neighbornet.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, region: true, subArea: true },
  });
  const byRegionName = new Map<string, (typeof existing)[number]>();
  for (const e of existing) byRegionName.set(`${e.region}::${norm(e.name)}`, e);

  let created = 0;
  let regrouped = 0;
  let already = 0;

  for (const { region, stateCode, subArea, names } of DATA) {
    for (const name of names) {
      const match = byRegionName.get(`${region}::${norm(name)}`);
      if (!match) {
        await db.neighbornet.create({
          data: { name, region, subArea, stateCode, createdById: admin?.id },
        });
        created++;
        console.log(`  + created "${name}" [${region} / ${subArea}]`);
      } else if (match.subArea !== subArea) {
        await db.neighbornet.update({
          where: { id: match.id },
          data: { subArea },
        });
        regrouped++;
        console.log(`  ~ regrouped "${match.name}": ${match.subArea} → ${subArea}`);
      } else {
        already++;
      }
    }
  }

  console.log(`\n✓ directory update: ${created} created, ${regrouped} regrouped, ${already} already correct`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
