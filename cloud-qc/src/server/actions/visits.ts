"use server";

import { revalidatePath } from "next/cache";

import { assertApproved } from "@/lib/authz";
import { db } from "@/lib/db";
import { memberName } from "@/lib/queries";
import {
  visitInputSchema,
  type VisitInput,
  type SubmitResult,
} from "@/lib/visit-schema";

function revalidateVisitViews() {
  revalidatePath("/dashboard");
  revalidatePath("/feedback");
  revalidatePath("/neighbornets", "layout");
  revalidatePath("/team", "layout");
  revalidatePath("/map");
}

async function createVisit(userId: string, input: VisitInput) {
  return db.visit.create({
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
  if (!nn || nn.archivedAt) {
    return { ok: false, error: "That neighbornet doesn't exist." };
  }

  const visitDate = new Date(`${input.visitDate}T00:00:00.000Z`);
  const existing = await db.visit.findFirst({
    where: {
      neighbornetId: input.neighbornetId,
      visitDate,
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
  if (!visit) return { ok: false, error: "That visit no longer exists." };

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

  revalidateVisitViews();
  return { ok: true, visitId: visit.id };
}

/** Edit a visit you submitted. */
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

  const visit = await db.visit.findUnique({
    where: { id: visitId },
    include: { participants: true },
  });
  if (!visit) return { ok: false, error: "That visit no longer exists." };
  if (visit.submittedById !== user.id) {
    return { ok: false, error: "You can only edit visits you submitted." };
  }

  const desired = new Set(input.coVisitorIds.filter((id) => id !== user.id));
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

  revalidateVisitViews();
  return { ok: true, visitId };
}

export async function toggleFeedbackSent(visitId: string) {
  await assertApproved();
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: { feedbackSent: true },
  });
  if (!visit) return;
  await db.visit.update({
    where: { id: visitId },
    data: { feedbackSent: !visit.feedbackSent },
  });
  revalidateVisitViews();
}
