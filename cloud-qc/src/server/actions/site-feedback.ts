"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin, getSessionUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { MAX_SCREENSHOT_CHARS } from "@/lib/site-feedback";

const rect = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  w: z.number().finite(),
  h: z.number().finite(),
});

const siteFeedbackSchema = z.object({
  path: z.string().trim().min(1).max(500),
  problem: z.string().trim().min(3, "Tell us what's wrong.").max(2000),
  suggestion: z.string().trim().max(2000).optional(),
  context: z
    .object({
      selector: z.string().max(400).optional(),
      text: z.string().max(600).optional(),
      rect: rect.optional(),
      viewport: z.object({ w: z.number(), h: z.number() }),
      scrollY: z.number().optional(),
      userAgent: z.string().max(400).optional(),
      theme: z.string().max(40).optional(),
    })
    .optional(),
  screenshot: z
    .string()
    .max(MAX_SCREENSHOT_CHARS)
    .startsWith("data:image/jpeg;base64,")
    .optional(),
});

export type SiteFeedbackInput = z.infer<typeof siteFeedbackSchema>;
export type SiteFeedbackResult = { ok: true } | { ok: false; error: string };

/** Anyone signed in and approved may leave feedback about the site — every
 *  role, so this checks status only (not the QC-member gate). */
async function assertApprovedAnyRole() {
  const session = await getSessionUser();
  if (!session) throw new Error("Unauthorized");
  const row = await db.user.findUnique({
    where: { id: session.id },
    select: { status: true },
  });
  if (row?.status !== "APPROVED") throw new Error("Unauthorized");
  return session;
}

export async function submitSiteFeedback(
  raw: SiteFeedbackInput,
): Promise<SiteFeedbackResult> {
  const user = await assertApprovedAnyRole();
  const parsed = siteFeedbackSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid feedback." };
  }
  const d = parsed.data;

  await db.siteFeedback.create({
    data: {
      authorId: user.id,
      path: d.path,
      problem: d.problem,
      suggestion: d.suggestion || null,
      context: d.context ? (d.context as Prisma.InputJsonValue) : Prisma.JsonNull,
      screenshot: d.screenshot ?? null,
    },
  });
  revalidatePath("/admin/site-feedback");
  return { ok: true };
}

const idSchema = z.object({ id: z.string().min(1) });

export async function setSiteFeedbackStatus(formData: FormData) {
  await assertAdmin();
  const { id } = idSchema.parse({ id: formData.get("id") });
  const status = z.enum(["NEW", "RESOLVED"]).parse(formData.get("status"));
  await db.siteFeedback.update({
    where: { id },
    data: { status, resolvedAt: status === "RESOLVED" ? new Date() : null },
  });
  revalidatePath("/admin/site-feedback");
}

export async function deleteSiteFeedback(formData: FormData) {
  await assertAdmin();
  const { id } = idSchema.parse({ id: formData.get("id") });
  await db.siteFeedback.delete({ where: { id } });
  revalidatePath("/admin/site-feedback");
}
