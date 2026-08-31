"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";

const schema = z.object({
  manualOffset: z.coerce.number().int().min(-100000).max(100000),
  goal: z
    .union([z.literal(""), z.coerce.number().int().min(0).max(1000000)])
    .transform((v) => (v === "" ? null : v)),
});

export type SettingsState = { ok?: boolean; error?: string };

export async function saveDashboardAdjustments(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const me = await assertAdmin();

  const parsed = schema.safeParse({
    manualOffset: formData.get("manualOffset"),
    goal: formData.get("goal"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter whole numbers only." };
  }

  const { manualOffset, goal } = parsed.data;

  await db.$transaction([
    db.appSetting.upsert({
      where: { key: "manual_visit_offset" },
      update: { value: manualOffset, updatedById: me.id },
      create: { key: "manual_visit_offset", value: manualOffset, updatedById: me.id },
    }),
    db.appSetting.upsert({
      where: { key: "visit_goal" },
      update: { value: goal ?? Prisma.JsonNull, updatedById: me.id },
      create: {
        key: "visit_goal",
        value: goal ?? Prisma.JsonNull,
        updatedById: me.id,
      },
    }),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/admin");
  revalidatePath("/team");
  return { ok: true };
}
