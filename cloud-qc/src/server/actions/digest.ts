"use server";

import { assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { buildDigestContent, digestEmailHtml } from "@/lib/digest";
import { sendDigestEmail } from "@/lib/resend";
import { memberName } from "@/lib/queries";

export type TestDigestState = { ok?: boolean; error?: string };

/** Admin-only: sends the caller a one-off copy of their own digest right
 *  now, regardless of cadence/due-ness, for eyeballing the formatting.
 *  Does NOT touch lastDigestSentAt. Not exposed to regular members — they
 *  already get an immediate digest the moment they turn on a cadence (see
 *  updateProfile), so there's nothing for them to manually trigger. */
export async function sendTestDigestToSelf(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- useActionState's required shape; this action ignores prior state and form input
  _prev: TestDigestState,
): Promise<TestDigestState> {
  const me = await assertAdmin();
  const user = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: {
      id: true,
      name: true,
      email: true,
      digestCadence: true,
      lastDigestSentAt: true,
    },
  });

  // A test send should work even for someone whose cadence is OFF — default
  // the lookback window to weekly in that case.
  const cadence = user.digestCadence === "OFF" ? "WEEKLY" : user.digestCadence;

  const content = await buildDigestContent(user.id, cadence, user.lastDigestSentAt);
  const { subject, html } = digestEmailHtml(content, {
    firstName: memberName(user).split(" ")[0] ?? "there",
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
  });

  const result = await sendDigestEmail({
    to: user.email,
    subject: `[Test] ${subject}`,
    html,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
