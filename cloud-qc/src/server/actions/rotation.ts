"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin, assertApproved } from "@/lib/authz";
import { db } from "@/lib/db";

const pairSchema = z.object({
  neighbornetId: z.string().min(1),
  userId: z.string().min(1),
});

function revalidateRotationViews() {
  revalidatePath("/rotation");
  revalidatePath("/dashboard");
  revalidatePath("/neighbornets", "layout");
}

async function addAssignment(
  neighbornetId: string,
  userId: string,
  assignedById: string | null,
) {
  const existing = await db.rotationAssignment.findFirst({
    where: { neighbornetId, userId, endedOn: null },
    select: { id: true },
  });
  if (existing) return;
  await db.rotationAssignment.create({
    data: { neighbornetId, userId, assignedById },
  });
}

async function endAssignment(neighbornetId: string, userId: string) {
  await db.rotationAssignment.updateMany({
    where: { neighbornetId, userId, endedOn: null },
    data: { endedOn: new Date() },
  });
}

export async function joinRotation(formData: FormData) {
  const user = await assertApproved();
  const neighbornetId = z.string().min(1).parse(formData.get("neighbornetId"));
  await addAssignment(neighbornetId, user.id, user.id);
  revalidateRotationViews();
}

export async function leaveRotation(formData: FormData) {
  const user = await assertApproved();
  const neighbornetId = z.string().min(1).parse(formData.get("neighbornetId"));
  await endAssignment(neighbornetId, user.id);
  revalidateRotationViews();
}

export async function assignRotation(formData: FormData) {
  const admin = await assertAdmin();
  const { neighbornetId, userId } = pairSchema.parse({
    neighbornetId: formData.get("neighbornetId"),
    userId: formData.get("userId"),
  });
  await addAssignment(neighbornetId, userId, admin.id);
  revalidateRotationViews();
}

export async function unassignRotation(formData: FormData) {
  const user = await assertApproved();
  const { neighbornetId, userId } = pairSchema.parse({
    neighbornetId: formData.get("neighbornetId"),
    userId: formData.get("userId"),
  });
  if (userId !== user.id && user.role !== "ADMIN") {
    throw new Error("Only an admin can remove someone else.");
  }
  await endAssignment(neighbornetId, userId);
  revalidateRotationViews();
}
