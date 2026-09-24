/**
 * Loads the "Expansions / SRs in Training" list (Sep 2026) onto the same
 * Neighbornet table as every established NN — see schema.prisma's
 * Neighbornet.stage comment for why this isn't a separate table.
 *
 * Several names on this list already exist as established, ACTIVE
 * neighbornets in the *same* state (Berkeley/LA/Corona, Las Vegas,
 * Mississauga, Calgary, Fishers, Minneapolis, Austin, Nashville, Baltimore).
 * Confirmed with the org rather than guessed: those are tagged
 * stage=EXPANSION IN PLACE on their existing row (no duplicate, history
 * kept) — even though they already have real visit history, per their
 * instruction. "Metro West" was also confirmed mis-tagged under Nevada and
 * is corrected to Massachusetts here as part of the same tag-in-place pass.
 *
 * Three more names collide by coincidence with an established NN in a
 * *different* state (Brighton: CA vs. this list's MA; Gainesville: FL vs.
 * this list's DMV) — treated as separate real places per the same
 * different-state precedent set for Westport (PA vs. KY) in the directory
 * update, NOT merged. Flag to the org if that's wrong.
 *
 * "YM San Fernando Valley" and "YM Valley" in the source sheet share the
 * exact same Instagram handle — the same place listed twice; kept once.
 *
 * Idempotent — safe to re-run.
 */
import { db } from "@/lib/db";

type NewItem = {
  name: string;
  region: string;
  subArea: string;
  stateCode: string | null;
  instagram?: string;
  comments?: string;
};

type TagItem = {
  matchName: string; // existing row to find, by (region, normalized name)
  matchRegion: string;
  instagram?: string; // only set if the existing row has none
  comments?: string;
};

// Existing rows to tag stage=EXPANSION in place — no new row created.
const TAG_IN_PLACE: TagItem[] = [
  { matchName: "Berkeley", matchRegion: "California" },
  { matchName: "Los Angeles", matchRegion: "California" },
  { matchName: "Corona", matchRegion: "California" },
  { matchName: "Las Vegas", matchRegion: "Nevada" },
  { matchName: "Mississauga", matchRegion: "Ontario, Canada", comments: "Needs to change Instagram username" },
  { matchName: "Calgary", matchRegion: "Alberta, Canada", comments: "Needs to change Instagram username" },
  { matchName: "Fishers", matchRegion: "Indiana", comments: "Directory sheet lists Instagram as @ym.fishers.brothers — differs from what's on file (@ym.brosfishers.brothers); verify before changing." },
  { matchName: "Minneapolis", matchRegion: "Minnesota" },
  { matchName: "Austin", matchRegion: "Texas", comments: "Realistically should be called YM Nueces" },
  { matchName: "Nashville", matchRegion: "Tennessee" },
  { matchName: "Baltimore", matchRegion: "Maryland" },
];

// Brand-new rows, all stage=EXPANSION.
const NEW_ITEMS: NewItem[] = [
  { name: "San Fernando Valley", region: "California", subArea: "California", stateCode: "CA", instagram: "@ym.valley.brothers" },
  { name: "East Valley", region: "Arizona", subArea: "Arizona", stateCode: "AZ", instagram: "@ym.eastvalley.brothers" },
  { name: "Windsor", region: "Ontario, Canada", subArea: "Ontario, Canada", stateCode: null, instagram: "@ym.windsor.brothers" },
  { name: "Charleston", region: "West Virginia", subArea: "West Virginia", stateCode: "WV" },
  { name: "Huntington", region: "West Virginia", subArea: "West Virginia", stateCode: "WV", instagram: "@ym.huntington.brothers" },
  { name: "Round Rock", region: "Texas", subArea: "Austin", stateCode: "TX", instagram: "@ym.round.rock.brothers" },
  { name: "DeZavala", region: "Texas", subArea: "Austin", stateCode: "TX", instagram: "@ym.dezavala.brothers" },
  { name: "Brushy Creek", region: "Texas", subArea: "Austin", stateCode: "TX", instagram: "@ym.brushycreek", comments: "Needs to change Instagram username" },
  { name: "Charlotte", region: "North Carolina", subArea: "North Carolina", stateCode: "NC", instagram: "@ymcharlottenc", comments: "Needs to change Instagram username" },
  { name: "Lowell", region: "Massachusetts", subArea: "Massachusetts", stateCode: "MA", instagram: "@ym.lowell.brothers" },
  { name: "Brighton", region: "Massachusetts", subArea: "Massachusetts", stateCode: "MA", instagram: "@ym.brighton.brothers", comments: "Different place from the existing California Brighton — confirm if these were meant to be the same." },
  { name: "Worcester", region: "Massachusetts", subArea: "Massachusetts", stateCode: "MA", instagram: "@ym.worcester.brothers" },
  { name: "Gainesville", region: "DMV", subArea: "DMV", stateCode: null, instagram: "@ym.gainesville.brothers", comments: "Different place from the existing Florida Gainesville — confirm if these were meant to be the same." },
  { name: "Falls Church", region: "DMV", subArea: "DMV", stateCode: null, instagram: "@ym.fallschurch.brothers" },
  { name: "Gaithersburg", region: "DMV", subArea: "DMV", stateCode: null, instagram: "@ym.gaithersburg.brothers" },
  { name: "Salisbury", region: "DMV", subArea: "DMV", stateCode: null, instagram: "@ym.salisbury.brothers" },
  { name: "Annapolis", region: "DMV", subArea: "DMV", stateCode: null, instagram: "@ym.annapolis.brothers" },
];

// Existing row moved + tagged, not just tagged — its region was simply wrong.
const METRO_WEST_FIX = { matchName: "Metro West", matchRegion: "Nevada", newRegion: "Massachusetts", newSubArea: "Massachusetts" };

function norm(s: string) {
  return s.toLowerCase().replace(/^ym[.\s]+/, "").replace(/[^a-z0-9]/g, "");
}

async function main() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });

  let tagged = 0;
  let created = 0;

  // Metro West: fix region + tag, in one update.
  const nvRows = await db.neighbornet.findMany({
    where: { region: METRO_WEST_FIX.matchRegion, archivedAt: null },
  });
  const mw = nvRows.find((e) => norm(e.name) === norm(METRO_WEST_FIX.matchName));
  if (mw) {
    await db.neighbornet.update({
      where: { id: mw.id },
      data: {
        region: METRO_WEST_FIX.newRegion,
        subArea: METRO_WEST_FIX.newSubArea,
        stage: "EXPANSION",
      },
    });
    tagged++;
    console.log(`✓ moved "Metro West" Nevada → Massachusetts and tagged EXPANSION`);
  } else {
    console.log(`⚠ "Metro West" not found under Nevada as expected — skipped, check manually`);
  }

  for (const item of TAG_IN_PLACE) {
    const existing = await db.neighbornet.findMany({
      where: { region: item.matchRegion, archivedAt: null },
    });
    const hit = existing.find((e) => norm(e.name) === norm(item.matchName));
    if (!hit) {
      console.log(`⚠ "${item.matchName}" not found under ${item.matchRegion} — skipped, check manually`);
      continue;
    }
    await db.neighbornet.update({
      where: { id: hit.id },
      data: {
        stage: "EXPANSION",
        instagram: hit.instagram ?? item.instagram,
        expansionComments: item.comments,
      },
    });
    tagged++;
    console.log(`✓ tagged "${hit.name}" (${item.matchRegion}) as EXPANSION`);
  }

  for (const item of NEW_ITEMS) {
    const all = await db.neighbornet.findMany({ where: { region: item.region, archivedAt: null } });
    if (all.some((e) => norm(e.name) === norm(item.name))) {
      console.log(`• "${item.name}" (${item.region}) already exists — skipped (re-run safety)`);
      continue;
    }
    await db.neighbornet.create({
      data: {
        name: item.name,
        region: item.region,
        subArea: item.subArea,
        stateCode: item.stateCode,
        instagram: item.instagram,
        expansionComments: item.comments,
        stage: "EXPANSION",
        createdById: admin?.id,
      },
    });
    created++;
    console.log(`  + created "${item.name}" [${item.region} / ${item.subArea}] (EXPANSION)`);
  }

  console.log(`\n✓ expansions load: ${tagged} tagged in place, ${created} created`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
