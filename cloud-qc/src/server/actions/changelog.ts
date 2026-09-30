"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/authz";
import { CHANGELOG } from "@/lib/changelog";
import { db } from "@/lib/db";

/** Remember that this person has seen a release, so the banner stays gone.
 *
 *  Deliberately does not go through assertApprovedAny's impersonation
 *  guard: an admin viewing as someone should still be able to dismiss the
 *  banner off their own screen, and marking it read is about the *reader*,
 *  not the account being viewed — so it writes against the real session. */
export async function dismissWhatsNew(releaseId: string) {
  const me = await getSessionUser();
  if (!me) return { ok: false as const };

  const id = z.string().min(1).parse(releaseId);
  if (!CHANGELOG.some((r) => r.id === id)) {
    return { ok: false as const };
  }

  await db.user.update({
    where: { id: me.id },
    data: { lastSeenChangelog: id },
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}

