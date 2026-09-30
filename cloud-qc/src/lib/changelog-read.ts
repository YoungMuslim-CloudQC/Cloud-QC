import "server-only";

import { CHANGELOG } from "@/lib/changelog";
import { db } from "@/lib/db";

/** Mark this person caught up on release notes.
 *
 *  Deliberately a plain server-side function rather than a Server Action:
 *  /whats-new calls it while rendering, and invoking a `"use server"`
 *  export during render is rejected at runtime — which is exactly how this
 *  page started returning 500 in production. Actions are for things a user
 *  triggers; this is just a write the page does. */
export async function markCaughtUp(userId: string): Promise<void> {
  const latest = CHANGELOG[0]?.id;
  if (!latest) return;
  await db.user.update({
    where: { id: userId },
    data: { lastSeenChangelog: latest },
  });
}
