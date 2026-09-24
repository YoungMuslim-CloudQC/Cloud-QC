/**
 * Fills in lat/lng for the neighbornets that were missing a map pin as of
 * Sep 2026 (mostly this month's directory/Expansions additions, plus a
 * handful of older gaps). City-center / known-address precision — the same
 * standard the rest of the map already uses, not exact street addresses.
 *
 * Where the neighbornet's name wasn't itself a standalone place (a masjid
 * nickname or a street name — "Synott", "IFN", "Potter", "4th Street"...),
 * the coordinate was found by looking up what that name actually refers to;
 * see each entry's `note`. Four are marked UNCERTAIN — a real address
 * couldn't be confirmed, so a reasonable area-center guess was used instead;
 * worth the org double-checking those specifically.
 *
 * Two more couldn't be resolved at all and are intentionally left with no
 * coordinates rather than guessed: the existing "Westport" (Pennsylvania)
 * and "Brighton" (California) neighbornets — both predate this pass.
 *
 * Only fills nulls — never overwrites a coordinate already on file.
 * Idempotent; safe to re-run.
 */
import { db } from "@/lib/db";

const COORDS: { name: string; region: string; lat: number; lng: number; note?: string }[] = [
  // --- resolved via search (specific address found) ---
  { name: "Maryam", region: "Texas", lat: 29.6197, lng: -95.6349, note: "Maryam Islamic Center, Sugar Land" },
  { name: "YM Masjid Hamza", region: "Texas", lat: 29.6836, lng: -95.6869, note: "Masjid Hamza, Houston" },
  { name: "Synott", region: "Texas", lat: 29.6494, lng: -95.6494, note: "Masjid At-Taqwa, Sugar Land" },
  { name: "IFN", region: "Illinois", lat: 42.3636, lng: -87.8448, note: "Islamic Foundation North, Waukegan" },
  { name: "Masjid al-Nur", region: "Pennsylvania", lat: 40.2148, lng: -77.0067, note: "Mechanicsburg" },
  { name: "Shelter Rock", region: "New York", lat: 40.7862, lng: -73.6440, note: "Roslyn" },
  { name: "Shelterock", region: "New York", lat: 40.7862, lng: -73.6440, note: "Roslyn — same place as Shelter Rock" },
  { name: "Five Town", region: "New York", lat: 40.6259, lng: -73.7276, note: "Cedarhurst, Five Towns" },
  { name: "Khair", region: "Pennsylvania", lat: 40.1373, lng: -75.5152, note: "Khair Community Center, Phoenixville" },
  { name: "Westport", region: "Kentucky", lat: 38.2871, lng: -85.5763, note: "Muslim Community Center of Louisville" },
  { name: "4th Street", region: "Kentucky", lat: 38.2211, lng: -85.7595, note: "S 4th St, Louisville" },
  { name: "Potter", region: "Illinois", lat: 42.0489, lng: -87.8956, note: "Des Plaines" },
  { name: "Locks", region: "Connecticut", lat: 41.9312, lng: -72.6470, note: "Windsor Locks" },
  { name: "San Fernando Valley", region: "California", lat: 34.1808, lng: -118.4517, note: "Van Nuys area" },
  { name: "Gainesville", region: "DMV", lat: 38.7962, lng: -77.6413, note: "Gainesville, VA" },

  // --- standard place names, no search needed ---
  { name: "East Valley", region: "Arizona", lat: 33.4152, lng: -111.8315 },
  { name: "Pittsburgh", region: "Pennsylvania", lat: 40.4406, lng: -79.9959 },
  { name: "Harrisburg", region: "Pennsylvania", lat: 40.2732, lng: -76.8867 },
  { name: "Lexington", region: "Kentucky", lat: 38.0406, lng: -84.5037 },
  { name: "Charleston", region: "West Virginia", lat: 38.3498, lng: -81.6326 },
  { name: "Huntington", region: "West Virginia", lat: 38.4192, lng: -82.4452 },
  { name: "McKinney", region: "Texas", lat: 33.1972, lng: -96.6398 },
  { name: "Prosper", region: "Texas", lat: 33.2362, lng: -96.8014 },
  { name: "Southlake", region: "Texas", lat: 32.9412, lng: -97.1342 },
  { name: "Colleyville", region: "Texas", lat: 32.8807, lng: -97.1550 },
  { name: "Round Rock", region: "Texas", lat: 30.5083, lng: -97.6789 },
  { name: "Brushy Creek", region: "Texas", lat: 30.5427, lng: -97.7286 },
  { name: "Wylie", region: "Texas", lat: 33.0151, lng: -96.5389 },
  { name: "Pearland", region: "Texas", lat: 29.5636, lng: -95.2860 },
  { name: "Maskaty", region: "Texas", lat: 29.7858, lng: -95.8244, note: "Katy" },
  { name: "Cumming", region: "Georgia", lat: 34.2073, lng: -84.1402 },
  { name: "Charlotte", region: "North Carolina", lat: 35.2271, lng: -80.8431 },
  { name: "Lowell", region: "Massachusetts", lat: 42.6334, lng: -71.3162 },
  { name: "Worcester", region: "Massachusetts", lat: 42.2626, lng: -71.8023 },
  { name: "Brighton", region: "Massachusetts", lat: 42.3496, lng: -71.1516 },
  { name: "Metro West", region: "Massachusetts", lat: 42.2793, lng: -71.4162, note: "Framingham" },
  { name: "Windsor", region: "Ontario, Canada", lat: 42.3149, lng: -83.0364 },
  { name: "Falls Church", region: "DMV", lat: 38.8823, lng: -77.1711 },
  { name: "Gaithersburg", region: "DMV", lat: 39.1434, lng: -77.2014 },
  { name: "Salisbury", region: "DMV", lat: 38.3607, lng: -75.5994 },
  { name: "Annapolis", region: "DMV", lat: 38.9784, lng: -76.4922 },
  { name: "Pembroke Pines", region: "Florida", lat: 26.0084, lng: -80.2456 },
  { name: "Blackwood", region: "New Jersey", lat: 39.8073, lng: -75.0716 },
  { name: "Voorhees", region: "New Jersey", lat: 39.8451, lng: -74.9527 },
  { name: "Morris County", region: "New Jersey", lat: 40.7968, lng: -74.4815, note: "Morristown" },
  { name: "North Hudson", region: "New Jersey", lat: 40.7795, lng: -74.0246, note: "Union City" },
  { name: "Wayne", region: "New Jersey", lat: 40.9276, lng: -74.2757 },
  { name: "Whiteplains", region: "New York", lat: 41.0340, lng: -73.7629, note: "White Plains" },
  { name: "Ronkonkoma", region: "New York", lat: 40.8226, lng: -73.1176 },
  { name: "Melville", region: "New York", lat: 40.7935, lng: -73.4143 },
  { name: "Barrington", region: "Illinois", lat: 42.1531, lng: -88.1362 },
  { name: "Boling Brook", region: "Illinois", lat: 41.6939, lng: -88.0684, note: "Bolingbrook" },
  { name: "YM New Haven", region: "Connecticut", lat: 41.3083, lng: -72.9279 },

  // --- low-confidence: generic area center, not a confirmed specific address ---
  { name: "Westside", region: "Illinois", lat: 41.8756, lng: -87.7200, note: "UNCERTAIN — generic Chicago West Side center, no specific masjid confirmed" },
  { name: "75", region: "Texas", lat: 32.9483, lng: -96.7299, note: "UNCERTAIN — Richardson, along the US-75 corridor; not a confirmed specific site" },
  { name: "DeZavala", region: "Texas", lat: 30.5083, lng: -97.6789, note: "UNCERTAIN — search only turned up a De Zavala Rd in San Antonio, not Austin; used Round Rock (its stated sub-area) as a fallback" },
  { name: "South Florida", region: "Florida", lat: 26.1224, lng: -80.1373, note: "UNCERTAIN — generic central Broward center, not a confirmed specific site" },
];

async function main() {
  let updated = 0;
  const notFound: string[] = [];
  for (const c of COORDS) {
    const rows = await db.neighbornet.findMany({
      where: { region: c.region, archivedAt: null },
      select: { id: true, name: true, latitude: true },
    });
    const hit = rows.find((r) => r.name.toLowerCase() === c.name.toLowerCase());
    if (!hit) {
      notFound.push(`${c.name} [${c.region}]`);
      continue;
    }
    if (hit.latitude != null) continue; // already has coords — never overwrite
    await db.neighbornet.update({
      where: { id: hit.id },
      data: { latitude: c.lat, longitude: c.lng },
    });
    updated++;
    console.log(`✓ ${hit.name} [${c.region}] -> ${c.lat}, ${c.lng}${c.note ? ` (${c.note})` : ""}`);
  }
  console.log(`\n✓ ${updated} coordinates added.`);
  if (notFound.length) console.log("NOT FOUND (check name/region):", notFound.join(", "));
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
