import { hash } from "@node-rs/argon2";
import { Prisma, PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// From the prototype's seed list: [name, subArea, contactEmail, instagram, lat, lng]
const NEIGHBORNETS: [string, string, string, string, number, number][] = [
  ["Teaneck", "North New Jersey", "nnc.teaneck@youngmuslims.com", "@ym.teaneck.brothers", 40.8976, -74.0154],
  ["Paramus", "North New Jersey", "nnc.paramus@youngmuslims.com", "@ym.paramus.brothers", 40.9445, -74.0754],
  ["Bayonne", "North New Jersey", "nnc.bayonne@youngmuslims.com", "@ym.bayonne.brothers", 40.6687, -74.1143],
  ["Jersey City", "North New Jersey", "nnc.jerseycity@youngmuslims.com", "@ym.jerseycity.brothers", 40.7178, -74.0431],
  ["Newark", "North New Jersey", "nnc.newark@youngmuslims.com", "@ym.newark.brothers", 40.7357, -74.1724],
  ["Piscataway", "South New Jersey", "nnc.piscataway@youngmuslims.com", "@ym.piscataway.brothers", 40.5548, -74.4646],
  ["Edison", "South New Jersey", "nnc.edison@youngmuslims.com", "@ym.edison.brothers", 40.5187, -74.4121],
  ["South Brunswick", "South New Jersey", "nnc.southbrunswick@youngmuslims.com", "@tm.southbrunswick.brothers", 40.3454, -74.5227],
  ["Montyboro", "South New Jersey", "nnc.montyboro@youngmuslims.com", "@ym.montyboro.brothers", 40.3157, -74.2632],
  ["South Jersey", "South New Jersey", "nnc.southjersey@youngmuslims.com", "@ym.southjersey.brothers", 39.9348, -75.0307],
  ["Woodbridge", "South New Jersey", "nnc.woodbridge@youngmuslims.com", "@ym.woodbridge.brothers", 40.5576, -74.2846],
  ["Old Bridge", "South New Jersey", "nnc.oldbridge@youngmuslims.com", "@ym.oldbridge.brothers", 40.4148, -74.3646],
  ["571", "South New Jersey", "nnc.woodbridge@youngmuslims.com", "@ym.571.brothers", 40.3223, -74.4302],
];

async function main() {
  // --- Admin bootstrap ---
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase().trim();
  if (!adminEmail) {
    throw new Error("SEED_ADMIN_EMAIL is not set — see .env.example");
  }
  const adminName = process.env.SEED_ADMIN_NAME?.trim() || "Admin";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  const passwordHash = adminPassword
    ? await hash(adminPassword, { memoryCost: 19456, timeCost: 2, parallelism: 1 })
    : undefined;

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN", status: "APPROVED" },
    create: {
      email: adminEmail,
      name: adminName,
      role: "ADMIN",
      status: "APPROVED",
      ...(passwordHash ? { passwordHash } : {}),
    },
  });
  console.log(`✓ admin: ${admin.email} (${admin.role}/${admin.status})`);

  // --- Neighbornets (only if the table is empty) ---
  const nnCount = await db.neighbornet.count();
  if (nnCount === 0) {
    for (const [name, subArea, contactEmail, instagram, lat, lng] of NEIGHBORNETS) {
      await db.neighbornet.create({
        data: {
          name,
          region: "Northeast",
          subArea,
          stateCode: "NJ",
          contactEmail,
          instagram,
          latitude: lat,
          longitude: lng,
          createdById: admin.id,
        },
      });
    }
    console.log(`✓ seeded ${NEIGHBORNETS.length} neighbornets`);
  } else {
    console.log(`• neighbornets already present (${nnCount}) — skipped`);
  }

  // --- App settings defaults ---
  await db.appSetting.upsert({
    where: { key: "manual_visit_offset" },
    update: {},
    create: { key: "manual_visit_offset", value: 0 },
  });
  await db.appSetting.upsert({
    where: { key: "visit_goal" },
    update: {},
    create: { key: "visit_goal", value: Prisma.JsonNull },
  });
  console.log("✓ app settings ready");
}

main()
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
