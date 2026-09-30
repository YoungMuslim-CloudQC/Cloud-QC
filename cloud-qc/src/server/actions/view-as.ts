"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRealAdmin, VIEW_AS_COOKIE } from "@/lib/authz";
import { db } from "@/lib/db";

/**
 * Start looking at the app as someone else. Admin-only, checked against the
 * *real* session rather than the effective one — otherwise an admin already
 * viewing as a coordinator could hop sideways into a third account without
 * ever being an admin at the moment of the check.
 *
 * Deliberately no audit trail beyond this: view-as can't write anything
 * (see assertApprovedAny), so there's nothing for it to have changed.
 */
export async function startViewAs(formData: FormData) {
  const admin = await requireRealAdmin();
  const userId = z.string().min(1).parse(formData.get("userId"));

  if (userId === admin.id) {
    redirect("/admin/view-as?error=self");
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });
  if (!target || target.status !== "APPROVED") {
    redirect("/admin/view-as?error=missing");
  }

  const jar = await cookies();
  jar.set(VIEW_AS_COOKIE, target.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Short-lived on purpose: this is a look, not a mode to live in. An
    // admin who forgets they're in it is the main way this goes wrong.
    maxAge: 60 * 60,
  });

  // Land where that person lands, so the first thing the admin sees is the
  // same first thing they'd see.
  redirect("/coordinator");
}

export async function stopViewAs() {
  await requireRealAdmin();
  const jar = await cookies();
  jar.delete(VIEW_AS_COOKIE);
  redirect("/admin/view-as");
}
