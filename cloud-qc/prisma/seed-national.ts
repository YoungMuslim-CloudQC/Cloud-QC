/**
 * One-time (but safely re-runnable) load of the full national neighbornet
 * directory, beyond the original NJ-only seed in seed.ts. Idempotent: upserts
 * by name, so running it again just confirms/updates rather than duplicating.
 *
 * The 13 existing North/South New Jersey neighbornets already match this
 * data exactly (checked against the live DB before writing this) and are
 * intentionally left out here — re-declaring them would be redundant, not
 * wrong, but this file is the record of what was *added*.
 *
 * "YM los angeles" (existing, region West / stateCode CA / same Instagram
 * handle) predates this file and is the same neighbornet as the new
 * "Los Angeles" entry below — updated in place, not duplicated.
 *
 * stateCode is left null for the two Canadian entries (Ontario, Alberta) —
 * Neighbornet.stateCode is a real 2-letter US state code elsewhere in the
 * app (map pins, state dropdowns); there's no equivalent for provinces, so
 * these just don't get a map pin rather than getting a wrong one.
 *
 * No lat/lng — none were provided for this list (unlike the original NJ
 * seed). These neighbornets will work everywhere (dashboard, team, digest,
 * the feedback form's neighbornet dropdown) except the pin-level state map,
 * which needs coordinates to place a dot.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

type NNInput = { name: string; instagram: string };
type SubAreaGroup = { subArea: string; stateCode: string | null; nns: NNInput[] };
type RegionGroup = { region: string; groups: SubAreaGroup[] };

const DATA: RegionGroup[] = [
  {
    region: "Northeast",
    groups: [
      {
        subArea: "East New York",
        stateCode: "NY",
        nns: [
          { name: "Jamaica", instagram: "@ym.jamaica.brothers" },
          { name: "Valley Stream", instagram: "@ym.valleystream.brothers" },
          { name: "Shelterock", instagram: "@ym.shelter.brothers" },
          { name: "East Meadow", instagram: "@ym.eastmeadow.brothers" },
          { name: "Flushing", instagram: "@ym.flushing.brothers" },
        ],
      },
      {
        subArea: "West New York",
        stateCode: "NY",
        nns: [
          { name: "Bronx", instagram: "@ym.bronx.brothers" },
          { name: "Brooklyn", instagram: "@ym.brooklyn.brothers" },
          { name: "Westchester", instagram: "@ym.westchester.brothers" },
        ],
      },
      {
        subArea: "Pennsylvania",
        stateCode: "PA",
        nns: [
          { name: "West Philly", instagram: "@ym.westphilly.brothers" },
          { name: "Westport", instagram: "@ym.westport.brothers" },
          { name: "Easton", instagram: "@ym.easton.brothers" },
          { name: "Devon", instagram: "@ym.devon.brothers" },
          { name: "Upper Darby", instagram: "@ym.upperdarby.brothers" },
          { name: "Khair", instagram: "@ym.khair.brothers" },
          { name: "West Chester", instagram: "@ym.wcpa.brothers" },
          { name: "Masjid al-Nur", instagram: "@ym.masjidalnur.brothers" },
        ],
      },
      {
        subArea: "Connecticut",
        stateCode: "CT",
        nns: [
          { name: "Stamford", instagram: "@ym.stamford.brothers" },
          { name: "Waterbury", instagram: "@ym.waterbury.brothers" },
          { name: "Berlin", instagram: "@ym.berlin.brothers" },
          { name: "Locks", instagram: "@ym.locks.brothers" },
        ],
      },
      {
        subArea: "Maryland",
        stateCode: "MD",
        nns: [{ name: "Baltimore", instagram: "@ym.baltimore.brothers" }],
      },
    ],
  },
  {
    region: "Southeast",
    groups: [
      {
        subArea: "Georgia",
        stateCode: "GA",
        nns: [
          { name: "Atlanta", instagram: "@ym.atlanta.brothers" },
          { name: "Lilburn", instagram: "@ym.lilburn.brothers" },
          { name: "Stone Mountain", instagram: "@ym.stonemountain.brothers" },
          { name: "East Cobb", instagram: "@ym.eastcobb.brothers" },
          { name: "Suwanee", instagram: "@ym.suwanee.brothers" },
        ],
      },
      {
        subArea: "Florida",
        stateCode: "FL",
        nns: [
          { name: "Pompano", instagram: "@ym.pompano.brothers" },
          // Source handle had a stray "@" ("@ym.jax@.brothers") — cleaned up
          // to match this org's consistent @ym.<name>.brothers pattern.
          { name: "Jacksonville", instagram: "@ym.jax.brothers" },
          { name: "Lake Mary", instagram: "@ym.lakemary.brothers" },
          { name: "Tampa", instagram: "@ym.tampa.brothers" },
          { name: "Miami", instagram: "@ym.miami.brothers" },
          { name: "West Palm Beach", instagram: "@ym.wpb.brothers" },
          { name: "Gainesville", instagram: "@ym.gainesville.brothers" },
        ],
      },
      {
        subArea: "Tennessee",
        stateCode: "TN",
        nns: [{ name: "Nashville", instagram: "@ym.nashville.brothers" }],
      },
    ],
  },
  {
    region: "Texas",
    groups: [
      {
        subArea: "Houston",
        stateCode: "TX",
        nns: [
          { name: "Maryam", instagram: "@ym.maryam.brothers" },
          // Source handle had a doubled "ym.ym" — cleaned to match the
          // standard pattern.
          { name: "YM Masjid Hamza", instagram: "@ym.masjidhamza.brothers" },
          { name: "Clear Lake", instagram: "@ym.clearlake.brothers" },
          { name: "Cinco Ranch", instagram: "@ym.cincoranch.brothers" },
          { name: "Bear Creek", instagram: "@ym.bearcreek.brothers" },
          { name: "Maskaty", instagram: "@ym.maskaty.brothers" },
          { name: "Cstat", instagram: "@ym.cstat.brothers" },
          { name: "Synott", instagram: "@ym.synott.brothers" },
          { name: "Cypress", instagram: "@ym.cypress.brothers" },
        ],
      },
      {
        subArea: "Dallas",
        stateCode: "TX",
        nns: [
          { name: "Carrollton", instagram: "@ym.carrollton.brothers" },
          { name: "Euless", instagram: "@ym.euless.brothers" },
          { name: "Irving", instagram: "@ym.irving.brothers" },
          { name: "Valley Ranch", instagram: "@ym.valleyranch.brothers" },
          { name: "Frisco", instagram: "@ym.frisco.brothers" },
          { name: "Richardson", instagram: "@ym.richardson.brothers" },
          { name: "East Plano", instagram: "@ym.eastplano.brothers" },
        ],
      },
      {
        subArea: "Austin",
        stateCode: "TX",
        nns: [{ name: "Austin", instagram: "@ym.austin.brothers" }],
      },
    ],
  },
  {
    region: "Midwest",
    groups: [
      {
        subArea: "Illinois",
        stateCode: "IL",
        nns: [
          { name: "Niles", instagram: "@ym.niles.brothers" },
          { name: "IFN", instagram: "@ym.ifn.brothers" },
          { name: "Plainfield", instagram: "@ym.plainfield.brothers" },
        ],
      },
      {
        subArea: "Indiana",
        stateCode: "IN",
        nns: [{ name: "Fishers", instagram: "@ym.brosfishers.brothers" }],
      },
      {
        subArea: "Minnesota",
        stateCode: "MN",
        nns: [{ name: "Minneapolis", instagram: "@ym.minneapolis.brothers" }],
      },
      {
        subArea: "Ontario, Canada",
        stateCode: null,
        nns: [{ name: "Mississauga", instagram: "@ym.mississauga.brothers" }],
      },
    ],
  },
  {
    region: "West",
    groups: [
      {
        subArea: "Nevada",
        stateCode: "NV",
        nns: [
          { name: "Las Vegas", instagram: "@ym.lasvegas.brothers" },
          { name: "Metro West", instagram: "@ym.metrowest.brothers" },
        ],
      },
      {
        subArea: "California",
        stateCode: "CA",
        nns: [
          { name: "Los Angeles", instagram: "@ym.losangeles.brothers" },
          { name: "Berkeley", instagram: "@ym.berkeley.brothers" },
          { name: "Corona", instagram: "@ym.corona.brothers" },
          { name: "Brighton", instagram: "@ym.brighton.brothers" },
          { name: "La Mirada", instagram: "@ym.lamirada.brothers" },
        ],
      },
      {
        subArea: "Alberta, Canada",
        stateCode: null,
        nns: [{ name: "Calgary", instagram: "@ym.calgary.brothers" }],
      },
    ],
  },
];

async function main() {
  const admin = await db.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });

  // "YM los angeles" predates this file and is the same place as the new
  // "Los Angeles" entry — fix it in place instead of creating a duplicate.
  const laFix = await db.neighbornet.updateMany({
    where: { name: "YM los angeles" },
    data: { name: "Los Angeles", region: "West", subArea: "California", stateCode: "CA" },
  });
  if (laFix.count > 0) console.log(`✓ renamed "YM los angeles" → "Los Angeles", fixed region/subArea`);

  let created = 0;
  let updated = 0;
  for (const { region, groups } of DATA) {
    for (const { subArea, stateCode, nns } of groups) {
      for (const nn of nns) {
        const existing = await db.neighbornet.findFirst({ where: { name: nn.name } });
        if (existing) {
          await db.neighbornet.update({
            where: { id: existing.id },
            data: { region, subArea, stateCode, instagram: nn.instagram },
          });
          updated++;
        } else {
          await db.neighbornet.create({
            data: {
              name: nn.name,
              region,
              subArea,
              stateCode,
              instagram: nn.instagram,
              createdById: admin?.id,
            },
          });
          created++;
        }
      }
    }
  }
  console.log(`✓ national directory: ${created} created, ${updated} updated`);
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
