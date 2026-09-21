/**
 * Fills in map coordinates (and city label) for neighbornets that don't have
 * them yet, so every one shows up as a city-level pin on the state map.
 *
 * Only touches rows whose latitude/longitude are still null — safe to re-run,
 * and never overwrites a location an admin set by hand. Neighbornets whose
 * name is a nickname rather than a place (so the city isn't knowable from the
 * data) are left alone and reported; set those from the neighbornet's edit
 * page, which has a click-to-place map.
 *
 *   npx tsx scripts/backfill-neighbornet-coords.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// key: "<name>|<subArea>" → [lat, lng, "City, ST"]
const PLACES: Record<string, [number, number, string]> = {
  // California
  "Berkeley|California": [37.8715, -122.273, "Berkeley, CA"],
  "Corona|California": [33.8753, -117.5664, "Corona, CA"],
  "La Mirada|California": [33.9172, -118.012, "La Mirada, CA"],
  // Connecticut
  "Berlin|Connecticut": [41.6215, -72.7457, "Berlin, CT"],
  "Stamford|Connecticut": [41.0534, -73.5387, "Stamford, CT"],
  "Waterbury|Connecticut": [41.5582, -73.0515, "Waterbury, CT"],
  // Florida
  "Gainesville|Florida": [29.6516, -82.3248, "Gainesville, FL"],
  "Jacksonville|Florida": [30.3322, -81.6557, "Jacksonville, FL"],
  "Lake Mary|Florida": [28.7589, -81.3178, "Lake Mary, FL"],
  "Miami|Florida": [25.7617, -80.1918, "Miami, FL"],
  "Pompano|Florida": [26.2379, -80.1248, "Pompano Beach, FL"],
  "Tampa|Florida": [27.9506, -82.4572, "Tampa, FL"],
  "West Palm Beach|Florida": [26.7153, -80.0534, "West Palm Beach, FL"],
  // Georgia
  "Atlanta|Georgia": [33.749, -84.388, "Atlanta, GA"],
  "East Cobb|Georgia": [33.97, -84.46, "East Cobb, GA"],
  "Lilburn|Georgia": [33.8901, -84.143, "Lilburn, GA"],
  "Stone Mountain|Georgia": [33.8081, -84.1702, "Stone Mountain, GA"],
  "Suwanee|Georgia": [34.0515, -84.0713, "Suwanee, GA"],
  // Illinois / Indiana / Minnesota / Maryland / Tennessee / Nevada
  "Niles|Illinois": [42.0189, -87.8128, "Niles, IL"],
  "Plainfield|Illinois": [41.632, -88.212, "Plainfield, IL"],
  "Fishers|Indiana": [39.9568, -86.0134, "Fishers, IN"],
  "Minneapolis|Minnesota": [44.9778, -93.265, "Minneapolis, MN"],
  "Baltimore|Maryland": [39.2904, -76.6122, "Baltimore, MD"],
  "Nashville|Tennessee": [36.1627, -86.7816, "Nashville, TN"],
  "Las Vegas|Nevada": [36.1699, -115.1398, "Las Vegas, NV"],
  // New York
  "East Meadow|East New York": [40.7139, -73.559, "East Meadow, NY"],
  "Flushing|East New York": [40.7675, -73.8331, "Flushing, NY"],
  "Jamaica|East New York": [40.7027, -73.789, "Jamaica, NY"],
  "Valley Stream|East New York": [40.6643, -73.7085, "Valley Stream, NY"],
  "Bronx|West New York": [40.8448, -73.8648, "Bronx, NY"],
  "Brooklyn|West New York": [40.6782, -73.9442, "Brooklyn, NY"],
  "Westchester|West New York": [41.122, -73.7949, "Westchester, NY"],
  // Pennsylvania
  "Devon|Pennsylvania": [40.0468, -75.4238, "Devon, PA"],
  "Easton|Pennsylvania": [40.6884, -75.2207, "Easton, PA"],
  "Upper Darby|Pennsylvania": [39.9548, -75.2996, "Upper Darby, PA"],
  "West Chester|Pennsylvania": [39.9607, -75.6055, "West Chester, PA"],
  "West Philly|Pennsylvania": [39.96, -75.21, "West Philadelphia, PA"],
  // Texas — Austin / Dallas / Houston sub-regions
  "Austin|Austin": [30.2672, -97.7431, "Austin, TX"],
  "Carrollton|Dallas": [32.9757, -96.89, "Carrollton, TX"],
  "East Plano|Dallas": [33.0198, -96.66, "Plano, TX"],
  "Euless|Dallas": [32.8371, -97.082, "Euless, TX"],
  "Frisco|Dallas": [33.1507, -96.8236, "Frisco, TX"],
  "Irving|Dallas": [32.814, -96.9489, "Irving, TX"],
  "Richardson|Dallas": [32.9483, -96.7299, "Richardson, TX"],
  "Valley Ranch|Dallas": [32.97, -96.95, "Valley Ranch, TX"],
  "Bear Creek|Houston": [29.83, -95.66, "Houston, TX"],
  "Cinco Ranch|Houston": [29.7402, -95.7585, "Katy, TX"],
  "Clear Lake|Houston": [29.5527, -95.0985, "Clear Lake, TX"],
  "Cstat|Houston": [30.628, -96.3344, "College Station, TX"],
  "Cypress|Houston": [29.9691, -95.6972, "Cypress, TX"],
  // Canada
  "Mississauga|Ontario, Canada": [43.589, -79.6441, "Mississauga, ON"],
  "Calgary|Alberta, Canada": [51.0447, -114.0719, "Calgary, AB"],
};

// One row was placed by hand in the wrong spot (north of LA, in Santa
// Clarita, for a neighbornet named "Los Angeles") — corrected explicitly.
const FIXES: Record<string, [number, number, string]> = {
  "Los Angeles|California": [34.0522, -118.2437, "Los Angeles, CA"],
};

async function main() {
  const rows = await db.neighbornet.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      name: true,
      subArea: true,
      city: true,
      latitude: true,
      longitude: true,
    },
    orderBy: [{ subArea: "asc" }, { name: "asc" }],
  });

  let updated = 0;
  const unplaced: string[] = [];

  for (const n of rows) {
    const key = `${n.name}|${n.subArea}`;
    const fix = FIXES[key];
    const place = PLACES[key];
    const hasCoords = n.latitude != null && n.longitude != null;

    if (fix) {
      await db.neighbornet.update({
        where: { id: n.id },
        data: { latitude: fix[0], longitude: fix[1], city: fix[2] },
      });
      console.log(`fixed   ${key} → ${fix[2]}`);
      updated++;
    } else if (!hasCoords && place) {
      await db.neighbornet.update({
        where: { id: n.id },
        data: {
          latitude: place[0],
          longitude: place[1],
          city: n.city ?? place[2],
        },
      });
      updated++;
    } else if (!hasCoords) {
      unplaced.push(`${n.name} (${n.subArea})`);
    }
  }

  console.log(`\nUpdated ${updated} neighbornets.`);
  if (unplaced.length) {
    console.log(
      `\nStill need a location (name isn't a city — set from the edit page):\n  ${unplaced.join("\n  ")}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
