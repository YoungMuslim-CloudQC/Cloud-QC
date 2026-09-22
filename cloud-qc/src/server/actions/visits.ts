"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { assertApproved } from "@/lib/authz";
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

function revalidateVisitViews() {
  revalidatePath("/dashboard");
  revalidatePath("/feedback");
  revalidatePath("/neighbornets", "layout");
  revalidatePath("/team", "layout");
  revalidatePath("/map");
  revalidatePath("/visits", "layout");
  revalidatePath("/admin/deleted-visits");
}

/** Snapshot the visit's current state and append a history row. */
async function recordHistory(
  visitId: string,
  action: HistoryAction,
  performedById: string,
) {
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    include: VISIT_SNAPSHOT_INCLUDE,
  });
  if (!visit) return;
  await db.visitHistory.create({
    data: {
      visitId,
      action,
      performedById,
      snapshot: buildVisitSnapshot(visit) as unknown as Prisma.InputJsonValue,
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

async function createVisit(
  userId: string,
  input: VisitInput,
  neighbornetId: string,
  jointEventId: string | null,
) {
  const visit = await db.visit.create({
    data: {
      neighbornetId,
      jointEventId,
      eventType: input.eventType,
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
          { userId, role: "SUBMITTER", contributed: true },
          ...input.coVisitorIds
            .filter((id) => id !== userId)
            .map((id) => ({
              userId: id,
              role: "CO_VISITOR" as const,
              contributed: false,
            })),
        ],
      },
    },
  });
  await recordHistory(visit.id, "CREATED", userId);
  await notifyCoordinators(visit.id); // no-op unless explicitly enabled in production
  return visit;
}

/** One Visit per neighbornet; if there's more than one, they're linked as a
 *  joint event so it's clear later they were the same underlying gathering. */
async function createVisitsForNeighbornets(
  userId: string,
  input: VisitInput,
  neighbornetIds: string[],
) {
  const jointEventId = neighbornetIds.length > 1 ? crypto.randomUUID() : null;
  const created: string[] = [];
  for (const nnId of neighbornetIds) {
    const visit = await createVisit(userId, input, nnId, jointEventId);
    created.push(visit.id);
  }
  return created;
}

/** Add the current user (and any co-visitors named in `input`) as
 *  participants on an already-existing visit, rather than logging a new one.
 *  Returns null if the visit is gone or deleted. */
async function joinVisitAsCoVisitor(
  existingVisitId: string,
  userId: string,
  input: VisitInput,
) {
  const visit = await db.visit.findUnique({
    where: { id: existingVisitId },
    include: { participants: { select: { userId: true } } },
  });
  if (!visit || visit.deletedAt) return null;

  const present = new Set(visit.participants.map((p) => p.userId));
  present.add(visit.submittedById);

  const toAdd: { userId: string; role: "CO_VISITOR"; contributed: boolean }[] = [];
  if (!present.has(userId)) {
    toAdd.push({ userId, role: "CO_VISITOR", contributed: true });
    present.add(userId);
  }
  for (const id of input.coVisitorIds) {
    if (!present.has(id)) {
      toAdd.push({ userId: id, role: "CO_VISITOR", contributed: false });
      present.add(id);
    }
  }

  await db.$transaction([
    ...(toAdd.length
      ? [
          db.visitParticipant.createMany({
            data: toAdd.map((p) => ({ ...p, visitId: visit.id })),
          }),
        ]
      : []),
    ...(input.notes
      ? [
          db.visitComment.create({
            data: { visitId: visit.id, authorId: userId, body: input.notes },
          }),
        ]
      : []),
  ]);

  await recordHistory(visit.id, "EDITED", userId);
  return visit.id;
}

/**
 * Primary submit. Returns `duplicates` (one entry per conflicting
 * neighbornet) if someone else already logged a visit to any of the selected
 * neighbornets on the same date and the caller isn't on it.
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

  const visitDate = new Date(`${input.visitDate}T00:00:00.000Z`);
  const duplicates: DuplicateInfo[] = [];
  for (const nn of nns) {
    const existing = await db.visit.findFirst({
      where: {
        neighbornetId: nn.id,
        visitDate,
        deletedAt: null,
        submittedById: { not: user.id },
        participants: { none: { userId: user.id } },
      },
      include: { submittedBy: { select: { name: true, email: true } } },
    });
    if (existing) {
      duplicates.push({
        visitId: existing.id,
        neighbornetId: nn.id,
        submittedByName: memberName(existing.submittedBy),
        neighbornetName: nn.name,
        visitDate: input.visitDate,
      });
    }
  }
  if (duplicates.length) {
    return { ok: false, duplicates };
  }

  const created = await createVisitsForNeighbornets(
    user.id,
    input,
    input.neighbornetIds,
  );
  revalidateVisitViews();
  return { ok: true, visitId: created[0] };
}

/** "Submit as separate visit(s)" after a duplicate prompt — ignores whatever
 *  conflicts were found and logs a fresh visit for every selected neighbornet. */
export async function submitSeparateVisit(raw: VisitInput): Promise<SubmitResult> {
  const user = await assertApproved();
  const parsed = visitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const created = await createVisitsForNeighbornets(
    user.id,
    parsed.data,
    parsed.data.neighbornetIds,
  );
  revalidateVisitViews();
  return { ok: true, visitId: created[0] };
}

/** "Link my visit" — join an existing visit as a co-visitor. */
export async function linkToExistingVisit(
  existingVisitId: string,
  raw: VisitInput,
): Promise<SubmitResult> {
  const user = await assertApproved();
  const parsed = visitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const joined = await joinVisitAsCoVisitor(existingVisitId, user.id, parsed.data);
  if (!joined) {
    return { ok: false, error: "That visit no longer exists." };
  }
  revalidateVisitViews();
  return { ok: true, visitId: joined };
}

/**
 * Resolve a duplicate-prompt for a (possibly multi-neighbornet) submission.
 * "link" joins each conflicting neighbornet's existing visit as a co-visitor
 * and still creates fresh visits for any neighbornet that didn't conflict;
 * "separate" just logs a new visit for every selected neighbornet.
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
    const created = await createVisitsForNeighbornets(
      user.id,
      input,
      input.neighbornetIds,
    );
    revalidateVisitViews();
    return { ok: true, visitId: created[0] };
  }

  const dupByNn = new Map(duplicates.map((d) => [d.neighbornetId, d.visitId]));
  const jointEventId = input.neighbornetIds.length > 1 ? crypto.randomUUID() : null;
  const created: string[] = [];
  for (const nnId of input.neighbornetIds) {
    const existingVisitId = dupByNn.get(nnId);
    if (existingVisitId) {
      const joined = await joinVisitAsCoVisitor(existingVisitId, user.id, input);
      if (joined) created.push(joined);
    } else {
      const visit = await createVisit(user.id, input, nnId, jointEventId);
      created.push(visit.id);
    }
  }
  revalidateVisitViews();
  return { ok: true, visitId: created[0] };
}

/** Edit a visit (original submitter, or an admin). */
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
  if (input.neighbornetIds.length !== 1) {
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

  await db.$transaction([
    db.visit.update({
      where: { id: visitId },
      data: {
        neighbornetId: input.neighbornetIds[0],
        eventType: input.eventType,
        visitDate: new Date(`${input.visitDate}T00:00:00.000Z`),
        groupSize: input.groupSize,
        avgAge: input.avgAge,
        foodRating: input.foodRating,
        leadershipRating: input.leadershipRating,
        halaqahRating: input.halaqahRating,
        status: input.status,
        notes: input.notes,
      },
    }),
    ...(removeIds.length
      ? [db.visitParticipant.deleteMany({ where: { id: { in: removeIds } } })]
      : []),
    ...(addIds.length
      ? [
          db.visitParticipant.createMany({
            data: addIds.map((id) => ({
              visitId,
              userId: id,
              role: "CO_VISITOR" as const,
              contributed: false,
            })),
          }),
        ]
      : []),
  ]);

  await recordHistory(visitId, "EDITED", user.id);
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
