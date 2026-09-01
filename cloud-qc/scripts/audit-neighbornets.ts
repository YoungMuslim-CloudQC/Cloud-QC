/**
 * One-off audit: list neighbornets whose stateCode is null or not a real
 * US state code (leftovers from before state validation was added), plus
 * any that are missing coordinates.
 *
 *   npm run audit:neighbornets
 */
import { PrismaClient } from "@prisma/client";

import { STATE_CODES } from "../src/lib/us-states";

const db = new PrismaClient();

async function main() {
  const all = await db.neighbornet.findMany({
    orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      stateCode: true,
      subArea: true,
      latitude: true,
      longitude: true,
      archivedAt: true,
    },
  });

  const badState = all.filter(
    (n) => !n.stateCode || !STATE_CODES.includes(n.stateCode.toUpperCase()),
  );
  const noCoords = all.filter((n) => n.latitude == null || n.longitude == null);

  console.log(`\n${all.length} neighbornets total\n`);

  console.log(`── Invalid or missing stateCode: ${badState.length} ──`);
  for (const n of badState) {
    console.log(
      `  ${n.id}  ${n.name}${n.archivedAt ? " (archived)" : ""}  stateCode=${JSON.stringify(n.stateCode)}`,
    );
  }

  console.log(`\n── Missing coordinates: ${noCoords.length} ──`);
  for (const n of noCoords) {
    console.log(
      `  ${n.id}  ${n.name}${n.archivedAt ? " (archived)" : ""}  state=${n.stateCode ?? "—"}`,
    );
  }

  console.log(
    "\nFix each with the edit form at /neighbornets/<id>/edit, or a direct update.\n",
  );
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
