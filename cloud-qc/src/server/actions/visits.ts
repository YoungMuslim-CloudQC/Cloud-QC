"use server";

import { revalidatePath } from "next/cache";
import { Prisma, type VisitStatus } from "@prisma/client";

import { assertApproved, assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { memberName } from "@/lib/queries";
import { notifyCoordinators } from "@/lib/coordinator-email";
import {
  buildVisitSnapshot,
  VISIT_SNAPSHOT_INCLUDE,
} from "@/lib/visit-history";
import {
  visitInputSchema,
  type VisitInput,
  type DuplicateInfo,
  type SubmitResult,
} from "@/lib/visit-schema";

type HistoryAction = "CREATED" | "EDITED" | "DELETED" | "RESTORED";
type Tx = Prisma.TransactionClient;

function revalidateVisitViews() {
  revalidatePath("/dashboard");
  revalidatePath("/feedback");
  revalidatePath("/neighbornets", "layout");
  revalidatePath("/team", "layout");
  revalidatePath("/map");
  revalidatePath("/visits", "layout");
  revalidatePath("/admin/deleted-visits");
  revalidatePath("/admin/visit-disputes");
}

/** Snapshot the visit's current state and append a history row. */
async function recordHistory(
  visitId: string,
  action: HistoryAction,
  performedById: string,
  client: Tx | typeof db = db,
) {
  const visit = await client.visit.findUnique({
    where: { id: visitId },
    include: VISIT_SNAPSHOT_INCLUDE,
  });
  if (!visit) return;
  await client.visitHistory.create({
    data: {
      visitId,
      action,
      performedById,
      snapshot: buildVisitSnapshot(visit) as unknown as Prisma.InputJsonValue,
    },
  });
}

const STATUS_SEVERITY: Record<VisitStatus, number> = {
  ON_TRACK: 0,
  NEEDS_FOLLOWUP: 1,
  URGENT: 2,
};

/**
 * Visit.status/foodRating/leadershipRating/halaqahRating are a cached
 * aggregate over every participant who contributed their own assessment —
 * worst status, averaged numeric ratings — never raw input beyond whoever
 * submitted first. Call this after any participant add/edit that touches
 * `contributed`/status/ratings, so every existing reader of those four
 * fields keeps working unchanged.
 */
async function recomputeVisitAggregates(tx: Tx, visitId: string) {
  const contributors = await tx.visitParticipant.findMany({
    where: { visitId, contributed: true },
    select: { status: true, foodRating: true, leadershipRating: true, halaqahRating: true },
  });
  if (contributors.length === 0) return;

  // foodRating/etc are SmallInt columns (whole stars) — round to the nearest
  // star rather than keep a fraction Prisma would otherwise just truncate
  // (a 3.5 average silently becoming a displayed "3" instead of "4").
  const avg = (vals: (number | null)[]) => {
    const present = vals.filter((v): v is number => v != null);
    return present.length
      ? Math.round(present.reduce((a, b) => a + b, 0) / present.length)
      : null;
  };
  const worstStatus = contributors
    .map((c) => c.status)
    .filter((s): s is VisitStatus => s != null)
    .reduce<VisitStatus | null>(
      (worst, s) => (worst == null || STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst),
      null,
    );

  await tx.visit.update({
    where: { id: visitId },
    data: {
      status: worstStatus,
      foodRating: avg(contributors.map((c) => c.foodRating)),
      leadershipRating: avg(contributors.map((c) => c.leadershipRating)),
      halaqahRating: avg(contributors.map((c) => c.halaqahRating)),
    },
  });
}

type ModifiableVisit = Prisma.VisitGetPayload<{
  include: { participants: true };
}>;
type LoadResult =
  | { ok: false; error: string }
  | { ok: true; visit: ModifiableVisit };

/** Edit / delete / restore permission — same rule as editing:
 *  the original submitter, or any admin. */
async function loadModifiableVisit(
  visitId: string,
  userId: string,
  isAdmin: boolean,
): Promise<LoadResult> {
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    include: { participants: true },
  });
  if (!visit) return { ok: false, error: "That visit no longer exists." };
  if (visit.submittedById !== userId && !isAdmin) {
    return {
      ok: false,
      error: "You don't have permission to change this visit.",
    };
  }
  return { ok: true, visit };
}

/** One Visit row. A VISIT-type event gets a VisitNeighbornet link per
 *  neighbornet (real credit on each); a BASH/SR_EVENT gets subRegion +
 *  mentionedNeighbornetIds instead (informational only, no NN gets credit).
 *  Either way this is exactly one row — the fact that makes "one visit, one
 *  point" hold regardless of how many NNs it touches. */
async function createVisit(
  tx: Tx,
  userId: string,
  input: VisitInput,
  jointEventId: string | null,
) {
  const isVisit = input.eventType === "VISIT";
  const visit = await tx.visit.create({
    data: {
      jointEventId,
      eventType: input.eventType,
      subRegion: isVisit ? null : (input.subRegion ?? null),
      mentionedNeighbornetIds: isVisit ? [] : input.neighbornetIds,
      neighbornetId: isVisit ? (input.neighbornetIds[0] ?? null) : null,
      visitDate: new Date(`${input.visitDate}T00:00:00.000Z`),
      submittedById: userId,
      groupSize: input.groupSize,
      avgAge: input.avgAge,
      foodRating: input.foodRating,
      leadershipRating: input.leadershipRating,
      halaqahRating: input.halaqahRating,
      status: input.status,
      notes: input.notes,
      participants: {
        create: [
          {
            userId,
            role: "SUBMITTER",
            contributed: true,
            status: input.status,
            foodRating: input.foodRating,
            leadershipRating: input.leadershipRating,
            halaqahRating: input.halaqahRating,
          },
          ...input.coVisitorIds
            .filter((id) => id !== userId)
            .map((id) => ({
              userId: id,
              role: "CO_VISITOR" as const,
              contributed: false,
            })),
        ],
      },
      ...(isVisit
        ? { neighbornets: { create: input.neighbornetIds.map((neighbornetId) => ({ neighbornetId })) } }
        : {}),
    },
  });
  await recordHistory(visit.id, "CREATED", userId, tx);
  return visit;
}

/** Coordinator emails read the visit back with a fresh (non-transactional)
 *  connection, so this must run only after the creating transaction has
 *  actually committed — never from inside it, or the row isn't visible yet
 *  and the notification silently no-ops. Best-effort either way. */
function notifyCoordinatorsIfVisit(visitId: string, eventType: VisitInput["eventType"]) {
  if (eventType === "VISIT") void notifyCoordinators(visitId);
}

/** Add the current user as a confirmed co-visitor on an existing visit, with
 *  their own status/ratings from `input` — or, if they're already listed
 *  (the submitter claimed them), fill in those same fields on their existing
 *  row instead of inserting a duplicate. Either way ends with exactly one
 *  contributed participant row for them, and the visit's cached aggregate
 *  recomputed. Returns null if the visit is gone or deleted. */
async function joinVisitAsCoVisitor(
  tx: Tx,
  existingVisitId: string,
  userId: string,
  input: VisitInput,
) {
  const visit = await tx.visit.findUnique({
    where: { id: existingVisitId },
    include: { participants: { select: { id: true, userId: true } } },
  });
  if (!visit || visit.deletedAt) return null;

  const own = visit.participants.find((p) => p.userId === userId);
  const ownRatings = {
    contributed: true,
    status: input.status,
    foodRating: input.foodRating,
    leadershipRating: input.leadershipRating,
    halaqahRating: input.halaqahRating,
  };
  if (own) {
    await tx.visitParticipant.update({ where: { id: own.id }, data: ownRatings });
  } else {
    await tx.visitParticipant.create({
      data: { visitId: visit.id, userId, role: "CO_VISITOR", ...ownRatings },
    });
  }

  const present = new Set(visit.participants.map((p) => p.userId));
  present.add(userId);
  const otherCoVisitors = input.coVisitorIds.filter((id) => !present.has(id));
  if (otherCoVisitors.length) {
    await tx.visitParticipant.createMany({
      data: otherCoVisitors.map((id) => ({
        visitId: visit.id,
        userId: id,
        role: "CO_VISITOR" as const,
        contributed: false,
      })),
    });
  }
  if (input.notes) {
    await tx.visitComment.create({
      data: { visitId: visit.id, authorId: userId, body: input.notes },
    });
  }

  await recomputeVisitAggregates(tx, visit.id);
  await recordHistory(visit.id, "EDITED", userId, tx);
  return visit.id;
}

/** Has this user already logged their own feedback for this NN on this
 *  date — as submitter, or as a co-visitor who confirmed with their own
 *  ratings? Deliberately excludes a merely-named (contributed=false) row:
 *  that's an unconfirmed claim, not a second log, and still needs to go
 *  through the match/confirm flow below rather than being blocked outright. */
async function findSelfConflict(
  tx: Tx,
  userId: string,
  neighbornetId: string,
  visitDate: Date,
  excludeVisitId?: string,
) {
  return tx.visit.findFirst({
    where: {
      deletedAt: null,
      eventType: "VISIT",
      visitDate,
      ...(excludeVisitId ? { id: { not: excludeVisitId } } : {}),
      neighbornets: { some: { neighbornetId } },
      participants: { some: { userId, contributed: true } },
    },
    select: { id: true },
  });
}

/** Same, across several neighbornets — returns the names of any that
 *  conflict (usually none, or one). */
async function findSelfConflicts(
  tx: Tx,
  userId: string,
  nns: { id: string; name: string }[],
  visitDate: Date,
  excludeVisitId?: string,
): Promise<string[]> {
  const names: string[] = [];
  for (const nn of nns) {
    if (await findSelfConflict(tx, userId, nn.id, visitDate, excludeVisitId)) {
      names.push(nn.name);
    }
  }
  return names;
}

/** VISIT-type only: an existing visit for this NN on this date, submitted by
 *  someone else — with whether the current user is already named on it. */
async function findMatch(tx: Tx, neighbornetId: string, visitDate: Date, userId: string) {
  return tx.visit.findFirst({
    where: {
      deletedAt: null,
      eventType: "VISIT",
      visitDate,
      submittedById: { not: userId },
      neighbornets: { some: { neighbornetId } },
    },
    include: {
      submittedBy: { select: { name: true, email: true } },
      participants: { select: { userId: true } },
    },
  });
}

/**
 * Primary submit. For a VISIT, checks each selected neighbornet for an
 * existing visit that day by someone else and returns `duplicates` (with
 * `alreadyClaimed` per rule 3) instead of creating anything if any are
 * found. BASH/SR_EVENT skip matching entirely — they don't grant NN credit,
 * so there's nothing to collide over.
 */
export async function submitFeedback(raw: VisitInput): Promise<SubmitResult> {
  const user = await assertApproved();
  const parsed = visitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const nns = await db.neighbornet.findMany({
    where: { id: { in: input.neighbornetIds } },
    select: { id: true, name: true, archivedAt: true },
  });
  if (nns.length !== input.neighbornetIds.length) {
    return { ok: false, error: "One of the selected neighbornets doesn't exist." };
  }
  const archived = nns.find((n) => n.archivedAt);
  if (archived) {
    return { ok: false, error: `${archived.name} is archived.` };
  }

  if (input.eventType === "VISIT") {
    const visitDate = new Date(`${input.visitDate}T00:00:00.000Z`);

    const selfConflicts = await findSelfConflicts(db, user.id, nns, visitDate);
    if (selfConflicts.length) {
      return {
        ok: false,
        error: `You already logged ${selfConflicts.join(", ")} on ${input.visitDate} — edit that entry instead of creating a new one.`,
      };
    }

    const duplicates: DuplicateInfo[] = [];
    for (const nn of nns) {
      const existing = await findMatch(db, nn.id, visitDate, user.id);
      if (existing) {
        duplicates.push({
          visitId: existing.id,
          neighbornetId: nn.id,
          submittedByName: memberName(existing.submittedBy),
          neighbornetName: nn.name,
          visitDate: input.visitDate,
          alreadyClaimed: existing.participants.some((p) => p.userId === user.id),
        });
      }
    }
    if (duplicates.length) {
      return { ok: false, duplicates };
    }
  }

  const visit = await db.$transaction((tx) => createVisit(tx, user.id, input, null));
  revalidateVisitViews();
  notifyCoordinatorsIfVisit(visit.id, input.eventType);
  return { ok: true, visitId: visit.id };
}

/** "Submit as separate visit" after a duplicate prompt — ignores whatever
 *  conflicts were found and logs one fresh visit. If any of the bypassed
 *  duplicates had already named this user as a participant, flags a dispute
 *  on that original visit for admin review (their claim vs. this "no"). */
export async function submitSeparateVisit(
  raw: VisitInput,
  duplicates: DuplicateInfo[] = [],
): Promise<SubmitResult> {
  const user = await assertApproved();
  const parsed = visitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  if (input.eventType === "VISIT" && input.neighbornetIds.length) {
    const visitDate = new Date(`${input.visitDate}T00:00:00.000Z`);
    const nns = await db.neighbornet.findMany({
      where: { id: { in: input.neighbornetIds } },
      select: { id: true, name: true },
    });
    const selfConflicts = await findSelfConflicts(db, user.id, nns, visitDate);
    if (selfConflicts.length) {
      return {
        ok: false,
        error: `You already logged ${selfConflicts.join(", ")} on ${input.visitDate} — edit that entry instead of creating a new one.`,
      };
    }
  }

  const visit = await db.$transaction(async (tx) => {
    const v = await createVisit(tx, user.id, input, null);
    for (const d of duplicates) {
      if (d.alreadyClaimed) {
        await tx.visitDispute.create({
          data: { visitId: d.visitId, disputedUserId: user.id, ownVisitId: v.id },
        });
      }
    }
    return v;
  });
  revalidateVisitViews();
  notifyCoordinatorsIfVisit(visit.id, input.eventType);
  return { ok: true, visitId: visit.id };
}

/** "Link my visit" — join an existing visit as a co-visitor with your own
 *  ratings. Used both for a single-NN match and as the confirm action from
 *  the duplicate banner. */
export async function linkToExistingVisit(
  existingVisitId: string,
  raw: VisitInput,
): Promise<SubmitResult> {
  const user = await assertApproved();
  const parsed = visitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const joined = await db.$transaction((tx) =>
    joinVisitAsCoVisitor(tx, existingVisitId, user.id, parsed.data),
  );
  if (!joined) {
    return { ok: false, error: "That visit no longer exists." };
  }
  revalidateVisitViews();
  return { ok: true, visitId: joined };
}

/**
 * Resolve a duplicate-prompt for a (possibly multi-neighbornet) submission.
 * "link" confirms every matched neighbornet (with this user's own ratings)
 * and still creates a fresh joint visit for whatever didn't match; "separate"
 * logs one fresh visit for every selected neighbornet regardless, flagging a
 * dispute for any match that had already named this user (see rule 3).
 */
export async function resolveJointDuplicates(
  raw: VisitInput,
  duplicates: DuplicateInfo[],
  mode: "link" | "separate",
): Promise<SubmitResult> {
  const user = await assertApproved();
  const parsed = visitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  if (mode === "separate") {
    return submitSeparateVisit(input, duplicates);
  }

  const dupByNn = new Map(duplicates.map((d) => [d.neighbornetId, d.visitId]));
  const unmatched = input.neighbornetIds.filter((id) => !dupByNn.has(id));
  const jointEventId = unmatched.length > 1 ? crypto.randomUUID() : null;

  if (unmatched.length) {
    const visitDate = new Date(`${input.visitDate}T00:00:00.000Z`);
    const unmatchedNns = await db.neighbornet.findMany({
      where: { id: { in: unmatched } },
      select: { id: true, name: true },
    });
    const selfConflicts = await findSelfConflicts(db, user.id, unmatchedNns, visitDate);
    if (selfConflicts.length) {
      return {
        ok: false,
        error: `You already logged ${selfConflicts.join(", ")} on ${input.visitDate} — edit that entry instead of creating a new one.`,
      };
    }
  }

  let newVisitId: string | null = null;
  const visitId = await db.$transaction(async (tx) => {
    const created: string[] = [];
    for (const [, existingVisitId] of dupByNn) {
      const joined = await joinVisitAsCoVisitor(tx, existingVisitId, user.id, input);
      if (joined) created.push(joined);
    }
    if (unmatched.length) {
      const v = await createVisit(tx, user.id, { ...input, neighbornetIds: unmatched }, jointEventId);
      created.push(v.id);
      newVisitId = v.id;
    }
    return created[0];
  });
  revalidateVisitViews();
  if (newVisitId) notifyCoordinatorsIfVisit(newVisitId, input.eventType);
  return { ok: true, visitId };
}

/** Edit a visit (original submitter, or an admin). Still single-NN/single-
 *  submission only — a joint or SR/Bash event is resubmitted fresh instead. */
export async function updateFeedback(
  visitId: string,
  raw: VisitInput,
): Promise<SubmitResult> {
  const user = await assertApproved();
  const parsed = visitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;
  if (input.eventType === "VISIT" && input.neighbornetIds.length !== 1) {
    return {
      ok: false,
      error: "Editing only supports one neighbornet — resubmit a new entry for a joint event.",
    };
  }

  const loaded = await loadModifiableVisit(
    visitId,
    user.id,
    user.role === "ADMIN",
  );
  if (!loaded.ok) return loaded;
  const { visit } = loaded;
  if (visit.deletedAt) {
    return { ok: false, error: "Restore this visit before editing it." };
  }

  if (input.eventType === "VISIT") {
    const visitDate = new Date(`${input.visitDate}T00:00:00.000Z`);
    const nn = await db.neighbornet.findUnique({
      where: { id: input.neighbornetIds[0] },
      select: { id: true, name: true },
    });
    if (nn) {
      const conflict = await findSelfConflict(
        db,
        visit.submittedById,
        nn.id,
        visitDate,
        visitId,
      );
      if (conflict) {
        return {
          ok: false,
          error: `${visit.submittedById === user.id ? "You" : "This member"} already logged ${nn.name} on ${input.visitDate} in another entry.`,
        };
      }
    }
  }

  const desired = new Set(
    input.coVisitorIds.filter((id) => id !== visit.submittedById),
  );
  const currentCo = visit.participants.filter((p) => p.role === "CO_VISITOR");
  const removeIds = currentCo
    .filter((p) => !desired.has(p.userId))
    .map((p) => p.id);
  const addIds = [...desired].filter(
    (id) => !currentCo.some((p) => p.userId === id),
  );
  const isVisit = input.eventType === "VISIT";

  await db.$transaction(async (tx) => {
    await tx.visit.update({
      where: { id: visitId },
      data: {
        neighbornetId: isVisit ? input.neighbornetIds[0] : null,
        eventType: input.eventType,
        subRegion: isVisit ? null : (input.subRegion ?? null),
        mentionedNeighbornetIds: isVisit ? [] : input.neighbornetIds,
        visitDate: new Date(`${input.visitDate}T00:00:00.000Z`),
        groupSize: input.groupSize,
        avgAge: input.avgAge,
        foodRating: input.foodRating,
        leadershipRating: input.leadershipRating,
        halaqahRating: input.halaqahRating,
        status: input.status,
        notes: input.notes,
      },
    });
    if (removeIds.length) {
      await tx.visitParticipant.deleteMany({ where: { id: { in: removeIds } } });
    }
    if (addIds.length) {
      await tx.visitParticipant.createMany({
        data: addIds.map((id) => ({
          visitId,
          userId: id,
          role: "CO_VISITOR" as const,
          contributed: false,
        })),
      });
    }
    // The submitter's own row is the input source of truth on edit — keep it
    // in step with the visit-level fields they just changed.
    await tx.visitParticipant.updateMany({
      where: { visitId, userId: visit.submittedById },
      data: {
        status: input.status,
        foodRating: input.foodRating,
        leadershipRating: input.leadershipRating,
        halaqahRating: input.halaqahRating,
      },
    });
    await tx.visitNeighbornet.deleteMany({ where: { visitId } });
    if (isVisit) {
      await tx.visitNeighbornet.create({
        data: { visitId, neighbornetId: input.neighbornetIds[0] },
      });
    }
    await recomputeVisitAggregates(tx, visitId);
    await recordHistory(visitId, "EDITED", user.id, tx);
  });

  revalidateVisitViews();
  return { ok: true, visitId };
}

export async function toggleFeedbackSent(visitId: string) {
  const user = await assertApproved();
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: { feedbackSent: true, deletedAt: true },
  });
  if (!visit || visit.deletedAt) return;
  await db.visit.update({
    where: { id: visitId },
    data: { feedbackSent: !visit.feedbackSent },
  });
  await recordHistory(visitId, "EDITED", user.id);
  revalidateVisitViews();
}

export async function deleteVisit(visitId: string): Promise<SubmitResult> {
  const user = await assertApproved();
  const loaded = await loadModifiableVisit(
    visitId,
    user.id,
    user.role === "ADMIN",
  );
  if (!loaded.ok) return loaded;
  if (loaded.visit.deletedAt) {
    return { ok: false, error: "That visit is already deleted." };
  }

  await db.visit.update({
    where: { id: visitId },
    data: { deletedAt: new Date() },
  });
  await recordHistory(visitId, "DELETED", user.id);
  revalidateVisitViews();
  return { ok: true, visitId };
}

export async function restoreVisit(visitId: string): Promise<SubmitResult> {
  const user = await assertApproved();
  const loaded = await loadModifiableVisit(
    visitId,
    user.id,
    user.role === "ADMIN",
  );
  if (!loaded.ok) return loaded;
  if (!loaded.visit.deletedAt) {
    return { ok: false, error: "That visit isn't deleted." };
  }

  await db.visit.update({
    where: { id: visitId },
    data: { deletedAt: null },
  });
  await recordHistory(visitId, "RESTORED", user.id);
  revalidateVisitViews();
  return { ok: true, visitId };
}

// ---------------------------------------------------------------------------
// Admin: visit disputes ("meets under review" — see rule 3's "no" case)
// ---------------------------------------------------------------------------

export type DisputeActionResult = { ok: true } | { ok: false; error: string };

/** Remove the disputing user from the original visit's participants — the
 *  admin siding with the "no, I wasn't there" side — and recompute its
 *  aggregate. Leaves the dispute open; call resolveVisitDispute to close it. */
export async function removeDisputedParticipant(
  disputeId: string,
): Promise<DisputeActionResult> {
  await assertAdmin();
  const dispute = await db.visitDispute.findUnique({ where: { id: disputeId } });
  if (!dispute) return { ok: false, error: "That dispute no longer exists." };

  await db.$transaction(async (tx) => {
    await tx.visitParticipant.deleteMany({
      where: { visitId: dispute.visitId, userId: dispute.disputedUserId },
    });
    await recomputeVisitAggregates(tx, dispute.visitId);
    await recordHistory(dispute.visitId, "EDITED", dispute.disputedUserId, tx);
  });
  revalidateVisitViews();
  return { ok: true };
}

export async function resolveVisitDispute(
  disputeId: string,
  note?: string,
): Promise<DisputeActionResult> {
  const admin = await assertAdmin();
  await db.visitDispute.update({
    where: { id: disputeId },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedById: admin.id, note },
  });
  revalidateVisitViews();
  return { ok: true };
}

export async function reopenVisitDispute(disputeId: string): Promise<DisputeActionResult> {
  await assertAdmin();
  await db.visitDispute.update({
    where: { id: disputeId },
    data: { status: "PENDING", resolvedAt: null, resolvedById: null },
  });
  revalidateVisitViews();
  return { ok: true };
}

/** Emails the original submitter that the person they named said they
 *  weren't there. Best-effort — a failed send doesn't fail the request. */
export async function notifyDisputeSubmitter(disputeId: string): Promise<DisputeActionResult> {
  await assertAdmin();
  const dispute = await db.visitDispute.findUnique({
    where: { id: disputeId },
    include: {
      visit: {
        include: { submittedBy: { select: { name: true, email: true } }, neighbornets: { include: { neighbornet: { select: { name: true } } } } },
      },
      disputedUser: { select: { name: true, email: true } },
    },
  });
  if (!dispute) return { ok: false, error: "That dispute no longer exists." };

  const { sendDigestEmail } = await import("@/lib/resend");
  const { isoDate } = await import("@/lib/format");
  const nnNames = dispute.visit.neighbornets.map((l) => l.neighbornet.name).join(", ") || "that visit";
  const subject = `${memberName(dispute.disputedUser)} said they weren't at your ${nnNames} visit`;
  const html = `<p>Hi ${memberName(dispute.visit.submittedBy).split(" ")[0]},</p>
<p>Your visit to <strong>${nnNames}</strong> on ${isoDate(dispute.visit.visitDate)} named
${memberName(dispute.disputedUser)} as a co-visitor. They logged their own feedback for the
same date and said they weren't there with you — an admin is reviewing it.</p>
<p>No action needed from you right now.</p>`;
  const sent = await sendDigestEmail({ to: dispute.visit.submittedBy.email, subject, html });
  if (sent.ok) {
    await db.visitDispute.update({ where: { id: disputeId }, data: { notifiedAt: new Date() } });
  }
  return sent.ok ? { ok: true } : { ok: false, error: sent.error };
}
