/**
 * Converts existing visit data to the new shape: joint events collapse from
 * N Visit rows into 1 + VisitNeighbornet links; Bash/SR-event visits stop
 * counting toward any NN's status/history; every remaining single-NN visit
 * gets its VisitNeighbornet link; VisitParticipant gets backfilled from the
 * submitter's own numbers.
 *
 * Dry run by default — reports exactly what it would do and writes nothing.
 *   npx tsx scripts/migrate-visit-integrity.ts           # report only
 *   npx tsx scripts/migrate-visit-integrity.ts --write    # apply
 */
import { PrismaClient } from "@prisma/client";
import { hysteresisStatus } from "../src/lib/neighbornet-status";

const db = new PrismaClient();
const WRITE = process.argv.includes("--write");

async function main() {
  const visits = await db.visit.findMany({
    include: {
      participants: { select: { id: true, userId: true, role: true, contributed: true } },
      comments: true,
      neighbornet: { select: { id: true, name: true, subArea: true, region: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Total visit rows (including soft-deleted): ${visits.length}\n`);

  // ---- 1. Joint-event groups: N rows -> 1 canonical + N VisitNeighbornet links
  const byJoint = new Map<string, typeof visits>();
  for (const v of visits) {
    if (!v.jointEventId) continue;
    const arr = byJoint.get(v.jointEventId) ?? [];
    arr.push(v);
    byJoint.set(v.jointEventId, arr);
  }

  console.log(`=== Joint-event groups: ${byJoint.size} ===`);
  const nnLinksToCreate: { visitId: string; neighbornetId: string }[] = [];
  const rowsToDelete: string[] = [];
  const commentsToRepoint: { commentId: string; toVisitId: string }[] = [];
  const participantsToCopy: {
    fromRowId: string;
    toVisitId: string;
    userId: string;
    role: "SUBMITTER" | "CO_VISITOR";
    contributed: boolean;
  }[] = [];
  // Non-VISIT joint groups (a Bash/SR event submitted via the multi-NN
  // picker) — same merge, but no NN gets credit; canonical becomes an
  // SR/Bash event with every tagged NN moved to "mentioned only".
  const bashSr: (typeof visits)[number][] = [];
  const mentionsByVisitId = new Map<string, string[]>();
  const subRegionByVisitId = new Map<string, string>();

  for (const [jointId, rows] of byJoint) {
    const sorted = [...rows].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
    );
    const canonical = sorted[0];
    const rest = sorted.slice(1);
    const types = new Set(sorted.map((r) => r.eventType));
    if (types.size > 1) {
      console.log(
        `  ${jointId}: MIXED eventTypes (${[...types].join(", ")}) — needs manual review, skipping.`,
      );
      continue;
    }
    const isCredited = canonical.eventType === "VISIT";
    console.log(
      `  ${jointId}: ${sorted.length} rows, ${canonical.eventType}, date ${canonical.visitDate.toISOString().slice(0, 10)}, submitter ${canonical.submittedById}`,
    );
    console.log(
      `    canonical -> ${canonical.id} (${canonical.neighbornet?.name ?? "?"}), keeps notes/ratings/status/participants as-is`,
    );
    if (isCredited) {
      nnLinksToCreate.push({ visitId: canonical.id, neighbornetId: canonical.neighbornetId! });
    } else {
      bashSr.push(canonical);
      console.log(`    (${canonical.eventType} — no NN gets real credit from this group)`);
    }

    for (const r of rest) {
      console.log(`    merges & deletes -> ${r.id} (${r.neighbornet?.name ?? "?"})`);
      if (isCredited) {
        nnLinksToCreate.push({ visitId: canonical.id, neighbornetId: r.neighbornetId! });
      }
      for (const c of r.comments) {
        commentsToRepoint.push({ commentId: c.id, toVisitId: canonical.id });
      }
      for (const p of r.participants) {
        const already = canonical.participants.some((cp) => cp.userId === p.userId);
        if (!already) {
          console.log(
            `      participant ${p.userId} exists on ${r.id} but not canonical — will copy over`,
          );
          participantsToCopy.push({
            fromRowId: r.id,
            toVisitId: canonical.id,
            userId: p.userId,
            role: p.role,
            contributed: p.contributed,
          });
        }
      }
      rowsToDelete.push(r.id);
    }

    if (!isCredited) {
      const allNnIds = sorted.map((r) => r.neighbornetId).filter((id): id is string => Boolean(id));
      mentionsByVisitId.set(canonical.id, [...new Set(allNnIds)]);
      const regions = new Set(sorted.map((r) => r.neighbornet?.region).filter(Boolean));
      subRegionByVisitId.set(
        canonical.id,
        regions.size === 1
          ? [...regions][0]!
          : (canonical.neighbornet?.subArea ?? canonical.neighbornet?.region ?? "unknown"),
      );
    }
  }
  console.log(
    `\nJoint merge summary: ${byJoint.size} groups -> ${byJoint.size} canonical visits, ${rowsToDelete.length} rows deleted, ${commentsToRepoint.length} comments re-pointed, ${participantsToCopy.length} participants copied over.\n`,
  );

  // ---- 2. Bash / SR-event visits (standalone or from a joint group above):
  // stop counting toward any NN.
  const standaloneBashSr = visits.filter((v) => v.eventType !== "VISIT" && !v.jointEventId);
  for (const v of standaloneBashSr) {
    bashSr.push(v);
    mentionsByVisitId.set(v.id, v.neighbornetId ? [v.neighbornetId] : []);
    subRegionByVisitId.set(v.id, v.neighbornet?.subArea ?? v.neighbornet?.region ?? "unknown");
  }
  console.log(`=== Bash / SR-event visits losing NN credit: ${bashSr.length} ===`);
  const affectedNnIds = new Set<string>();
  for (const v of bashSr) {
    const mentioned = mentionsByVisitId.get(v.id) ?? [];
    console.log(
      `  ${v.id} (${v.eventType}) ${v.visitDate.toISOString().slice(0, 10)} — was tied to ${mentioned.length} NN(s), subRegion -> "${subRegionByVisitId.get(v.id)}"`,
    );
    for (const id of mentioned) affectedNnIds.add(id);
  }

  // Every row keeps its own real visitDate/status regardless of merging, so
  // the post-migration picture per NN is exactly nnLinksToCreate resolved
  // against this map — not re-derived by matching against what's deleted.
  const visitById = new Map(visits.map((v) => [v.id, { visitDate: v.visitDate, status: v.status }]));

  if (affectedNnIds.size > 0) {
    console.log(`\n  Status impact on the ${affectedNnIds.size} affected NN(s):`);
    for (const nnId of affectedNnIds) {
      const nn = await db.neighbornet.findUnique({ where: { id: nnId }, select: { name: true } });
      const before = await db.visit.findMany({
        where: { neighbornetId: nnId, deletedAt: null },
        select: { visitDate: true, status: true },
      });
      const after = nnLinksToCreate
        .filter((l) => l.neighbornetId === nnId)
        .map((l) => visitById.get(l.visitId)!)
        .filter(Boolean);
      const beforeStatus = hysteresisStatus(before);
      const afterStatus = hysteresisStatus(after);
      const changed = beforeStatus !== afterStatus ? "  <-- CHANGES" : "";
      console.log(
        `    ${nn?.name}: ${before.length} visit(s) -> ${after.length} visit(s), ${beforeStatus ?? "—"} -> ${afterStatus ?? "—"}${changed}`,
      );
    }
  }
  console.log();

  // ---- 3. Plain single-NN VISIT rows: just get a VisitNeighbornet link
  const plain = visits.filter((v) => v.eventType === "VISIT" && !v.jointEventId);
  for (const v of plain) {
    if (v.neighbornetId) nnLinksToCreate.push({ visitId: v.id, neighbornetId: v.neighbornetId });
  }
  console.log(`=== Plain single-NN visits: ${plain.length} (straightforward 1:1 link) ===\n`);

  // ---- 4. VisitParticipant backfill
  const submitterRows = visits
    .filter((v) => !rowsToDelete.includes(v.id))
    .flatMap((v) => v.participants.filter((p) => p.role === "SUBMITTER").map((p) => ({ p, v })));
  console.log(`=== Participant backfill ===`);
  console.log(
    `  ${submitterRows.length} SUBMITTER rows get status/ratings copied from their visit's own fields.`,
  );
  console.log(
    `  Existing CO_VISITOR rows (even contributed=true) get nothing — their original ratings were never`,
  );
  console.log(
    `  captured by the old linking flow, so there's nothing to recover. Displayed Visit.status/ratings`,
  );
  console.log(`  for existing visits are UNCHANGED by this migration either way.\n`);

  console.log(
    `=== Totals: ${nnLinksToCreate.length} VisitNeighbornet rows to create, ${rowsToDelete.length} duplicate rows to delete ===`,
  );

  if (!WRITE) {
    console.log("\nDry run only — nothing written. Re-run with --write to apply.");
    return;
  }

  console.log("\nWriting...");
  await db.$transaction(async (tx) => {
    for (const c of commentsToRepoint) {
      await tx.visitComment.update({ where: { id: c.commentId }, data: { visitId: c.toVisitId } });
    }
    for (const p of participantsToCopy) {
      await tx.visitParticipant.create({
        data: {
          visitId: p.toVisitId,
          userId: p.userId,
          role: p.role,
          contributed: p.contributed,
        },
      });
    }
    if (rowsToDelete.length) {
      await tx.visit.deleteMany({ where: { id: { in: rowsToDelete } } });
    }
    for (const link of nnLinksToCreate) {
      await tx.visitNeighbornet.upsert({
        where: { visitId_neighbornetId: { visitId: link.visitId, neighbornetId: link.neighbornetId } },
        create: link,
        update: {},
      });
    }
    for (const v of bashSr) {
      await tx.visit.update({
        where: { id: v.id },
        data: {
          mentionedNeighbornetIds: mentionsByVisitId.get(v.id) ?? [],
          subRegion: subRegionByVisitId.get(v.id) ?? null,
          neighbornetId: null,
        },
      });
    }
    for (const { p, v } of submitterRows) {
      await tx.visitParticipant.update({
        where: { id: p.id },
        data: {
          status: v.status,
          foodRating: v.foodRating,
          leadershipRating: v.leadershipRating,
          halaqahRating: v.halaqahRating,
        },
      });
    }
  });
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
