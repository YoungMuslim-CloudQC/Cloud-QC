import "server-only";

import { db } from "@/lib/db";
import { toE164 } from "@/lib/phone";
import { sendSms } from "@/lib/twilio";

export type DeliveryResult =
  | { ok: true; sid: string }
  | { ok: false; reason: string };

/**
 * The only way the app sends a text to a person.
 *
 * Everything that wants to text someone goes through here, because consent
 * has to be decided in exactly one place. Scattering the check across the
 * cron, the alert path and the opt-in flow means the next caller added is
 * the one that forgets it — and the failure mode there isn't a bug report,
 * it's a carrier complaint.
 *
 * Consent is re-read from the database at send time rather than trusted
 * from whatever the caller happens to be holding. A list built five minutes
 * ago can contain someone who has replied STOP since.
 */
export async function sendToUser(
  userId: string,
  body: string,
): Promise<DeliveryResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      phone: true,
      smsConsent: true,
      notificationChannel: true,
      status: true,
    },
  });

  if (!user) return { ok: false, reason: "no such user" };
  if (user.status !== "APPROVED") return { ok: false, reason: "account not approved" };
  if (!user.smsConsent) return { ok: false, reason: "no SMS consent" };
  if (user.notificationChannel === "EMAIL") {
    return { ok: false, reason: "channel is email only" };
  }
  if (!user.phone) return { ok: false, reason: "no phone number" };

  const phone = toE164(user.phone);
  if (!phone) return { ok: false, reason: `unusable phone number: ${user.phone}` };

  // A REVOKED event beats the boolean. The two are kept in step, but an
  // inbound STOP writes the event first — so if they ever disagree, the
  // event is the newer truth and the safe one to believe.
  const latest = await db.smsConsentEvent.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
    select: { action: true },
  });
  if (latest?.action === "REVOKED") {
    return { ok: false, reason: "opted out (STOP)" };
  }

  const sent = await sendSms(phone, body);
  // Normalised to one failure shape so callers have a single field to log,
  // whether the refusal came from the consent checks above or from Twilio.
  return sent.ok ? sent : { ok: false, reason: sent.error };
}

/** Record an opt-out against a number, from wherever it came — an inbound
 *  STOP, or an admin acting on a request. Appends rather than edits, and
 *  clears the boolean on any account holding that number. */
export async function recordOptOut(
  phoneRaw: string,
  source: string,
): Promise<{ phone: string; matchedUsers: number }> {
  const phone = toE164(phoneRaw) ?? phoneRaw;

  const candidates = await db.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  const matched = candidates.filter((c) => c.phone && toE164(c.phone) === phone);

  await db.smsConsentEvent.create({
    data: {
      action: "REVOKED",
      phone,
      consentText: "(opt-out)",
      source,
      userId: matched[0]?.id ?? null,
    },
  });

  if (matched.length) {
    await db.user.updateMany({
      where: { id: { in: matched.map((m) => m.id) } },
      data: {
        smsConsent: false,
        smsConsentAt: null,
        // Falling back to email rather than leaving them on a channel that
        // can no longer deliver — otherwise opting out of texts silently
        // opts them out of everything.
        notificationChannel: "EMAIL",
      },
    });
  }

  return { phone, matchedUsers: matched.length };
}
