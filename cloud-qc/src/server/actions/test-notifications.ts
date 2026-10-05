"use server";

import { requireRealAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { buildDigestContent, digestEmailHtml } from "@/lib/digest";
import { buildCoordinatorDigestContent } from "@/lib/coordinator-digest";
import { memberName } from "@/lib/queries";
import { toE164, formatE164 } from "@/lib/phone";
import { sendDigestEmail } from "@/lib/resend";
import { smsWelcome } from "@/lib/sms-templates";
import { configProblems, isConfigured, sendSms } from "@/lib/twilio";

export type TestResult = { ok: boolean; message: string };

/**
 * Send the admin their own digest, right now.
 *
 * Deliberately hard-wired to the caller's own account — it takes no
 * recipient at all. An admin panel that can email an arbitrary address on
 * demand is a spam vector, and "send one to me so I can see it" is the
 * entire use case.
 *
 * Does not touch lastDigestSentAt: this is a preview, and marking it as a
 * real send would suppress the genuine one that's due next.
 */
export async function sendTestDigest(formData: FormData): Promise<TestResult> {
  const me = await requireRealAdmin();

  const variant = formData.get("variant") === "coordinator" ? "coordinator" : "member";

  const row = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: { id: true, name: true, email: true, digestCadence: true, lastDigestSentAt: true },
  });

  try {
    const content =
      variant === "coordinator"
        ? await buildCoordinatorDigestContent(row.id)
        : await buildDigestContent(
            row.id,
            // A cadence of OFF has no window to build from, so preview the
            // weekly one rather than refusing.
            row.digestCadence === "OFF" ? "WEEKLY" : row.digestCadence,
            row.lastDigestSentAt,
          );

    const { subject, html } = digestEmailHtml(content, {
      firstName: memberName(row).split(" ")[0] ?? "there",
      appUrl: process.env.APP_URL ?? "http://localhost:3000",
    });

    const sent = await sendDigestEmail({
      to: row.email,
      subject: `[Test] ${subject}`,
      html,
    });

    if (!sent.ok) return { ok: false, message: `Email failed: ${sent.error}` };
    return {
      ok: true,
      message: `${variant === "coordinator" ? "Coordinator" : "Member"} digest sent to ${row.email}.`,
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not build the digest.",
    };
  }
}

/**
 * Send one test text.
 *
 * Takes a number because the admin's profile may not have one, but this is
 * strictly a configuration check: it sends the opt-in confirmation wording
 * and writes no consent record. Receiving a test is not consent, and
 * recording it as such would put a number in the log that never agreed to
 * anything.
 */
export async function sendTestSms(formData: FormData): Promise<TestResult> {
  await requireRealAdmin();

  if (!isConfigured()) {
    return { ok: false, message: `Twilio config: ${configProblems().join("; ")}.` };
  }

  const raw = String(formData.get("phone") ?? "");
  const phone = toE164(raw);
  if (!phone) {
    return { ok: false, message: "Enter a valid US or Canadian mobile number." };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const res = await sendSms(phone, smsWelcome(appUrl));

  if (!res.ok) {
    // Twilio's own error text is far more useful than a generic failure —
    // code 21608 means an unverified number on a trial account, 21610 means
    // that number previously replied STOP, and so on.
    return {
      ok: false,
      message: `Twilio refused it${res.code ? ` (code ${res.code})` : ""}: ${res.error}`,
    };
  }
  return { ok: true, message: `Sent to ${formatE164(phone)}. Message SID ${res.sid}.` };
}
