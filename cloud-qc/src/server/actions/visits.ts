"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

import { assertApproved } from "@/lib/authz";
import { db } from "@/lib/db";
import { memberName } from "@/lib/queries";
import {
  buildVisitSnapshot,
  VISIT_SNAPSHOT_INCLUDE,
} from "@/lib/visit-history";
import {
  visitInputSchema,
  type VisitInput,
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

async function createVisit(userId: string, input: VisitInput) {
  const visit = await db.visit.create({
    data: {
      neighbornetId: input.neighbornetId,
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
  return visit;
}

/**
 * Primary submit. Returns a `duplicate` result if someone else already logged
 * a visit to the same neighbornet on the same date and the caller isn't on it.
 */
export async function submitFeedback(raw: VisitInput): Promise<SubmitResult> {
  const user = await assertApproved();
  const parsed = visitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  const nn = await db.neighbornet.findUnique({
    where: { id: input.neighbornetId },
    select: { id: true, name: true, archivedAt: true },
  });
  if (!nn) {
    return { ok: false, error: "That neighbornet doesn't exist." };
  }
  if (nn.archivedAt) {
    return { ok: false, error: "That neighbornet is archived." };
  }

  const visitDate = new Date(`${input.visitDate}T00:00:00.000Z`);
  const existing = await db.visit.findFirst({
    where: {
      neighbornetId: input.neighbornetId,
      visitDate,
      deletedAt: null,
      submittedById: { not: user.id },
      participants: { none: { userId: user.id } },
    },
    include: { submittedBy: { select: { name: true, email: true } } },
  });

  if (existing) {
    return {
      ok: false,
      duplicate: {
        visitId: existing.id,
        submittedByName: memberName(existing.submittedBy),
        neighbornetName: nn.name,
        visitDate: input.visitDate,
      },
    };
  }

  const visit = await createVisit(user.id, input);
  revalidateVisitViews();
  return { ok: true, visitId: visit.id };
}

/** "Submit as a separate visit" after a duplicate prompt. */
export async function submitSeparateVisit(raw: VisitInput): Promise<SubmitResult> {
  const user = await assertApproved();
  const parsed = visitInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const visit = await createVisit(user.id, parsed.data);
  revalidateVisitViews();
  return { ok: true, visitId: visit.id };
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
  const input = parsed.data;

  const visit = await db.visit.findUnique({
    where: { id: existingVisitId },
    include: { participants: { select: { userId: true } } },
  });
  if (!visit || visit.deletedAt) {
    return { ok: false, error: "That visit no longer exists." };
  }

  const present = new Set(visit.participants.map((p) => p.userId));
  present.add(visit.submittedById);

  const toAdd: { userId: string; role: "CO_VISITOR"; contributed: boolean }[] = [];
  if (!present.has(user.id)) {
    toAdd.push({ userId: user.id, role: "CO_VISITOR", contributed: true });
    present.add(user.id);
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
            data: { visitId: visit.id, authorId: user.id, body: input.notes },
          }),
        ]
      : []),
  ]);

  await recordHistory(visit.id, "EDITED", user.id);
  revalidateVisitViews();
  return { ok: true, visitId: visit.id };
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
        neighbornetId: input.neighbornetId,
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
