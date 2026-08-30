"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";

const idSchema = z.object({ userId: z.string().min(1) });

export async function approveUser(formData: FormData) {
  await assertAdmin();
  const { userId } = idSchema.parse({ userId: formData.get("userId") });
  await db.user.update({
    where: { id: userId },
    data: { status: "APPROVED" },
  });
  revalidatePath("/admin");
  revalidatePath("/team");
}

export async function rejectUser(formData: FormData) {
  await assertAdmin();
  const { userId } = idSchema.parse({ userId: formData.get("userId") });
  await db.user.update({
    where: { id: userId },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin");
  revalidatePath("/team");
}

export async function setUserRole(formData: FormData) {
  const me = await assertAdmin();
  const { userId } = idSchema.parse({ userId: formData.get("userId") });
  const role = z.enum(["MEMBER", "ADMIN"]).parse(formData.get("role"));

  if (userId === me.id && role === "MEMBER") {
    throw new Error("You can't remove your own admin access.");
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
}
