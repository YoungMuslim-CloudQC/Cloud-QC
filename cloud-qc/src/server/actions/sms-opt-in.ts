"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { db } from "@/lib/db";
import { toE164 } from "@/lib/phone";
import { SMS_CONSENT_TEXT } from "@/lib/sms-consent-copy";
import { smsWelcome } from "@/lib/sms-templates";
import { isConfigured, sendSms } from "@/lib/twilio";

export type OptInResult =
  | { ok: true; phone: string }
  | { ok: false; error: string; field?: "phone" | "consent" };

const schema = z.object({
  phone: z.string().trim().min(1),
  // An unchecked box submits nothing at all, so this has to tolerate a
  // missing value and treat it as "no" rather than failing validation.
  consent: z.union([z.literal("on"), z.literal("true")]).optional(),
});

/**
 * Record an SMS opt-in from the public form.
 *
 * Unauthenticated on purpose: the whole point of the page is that a carrier
 * reviewer, or a member who isn't signed in, can reach it. That means
 * treating everything here as hostile input — the number is re-validated
 * server-side, and consent is only ever taken from the submitted checkbox,
 * never defaulted.
 */
export async function submitSmsOptIn(formData: FormData): Promise<OptInResult> {
  const parsed = schema.safeParse({
    phone: formData.get("phone") ?? "",
    consent: formData.get("consent") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: "Enter your mobile number to continue.", field: "phone" };
  }

  // Checked server-side as well as in the browser. A consent record created
  // without the box ticked would be worthless as proof, so this is the check
  // that actually matters — the client-side one is only there to be helpful.
  if (!parsed.data.consent) {
    return {
      ok: false,
      error: "Please tick the box to agree to receive text messages.",
      field: "consent",
    };
  }

  const phone = toE164(parsed.data.phone);
  if (!phone) {
    return {
      ok: false,
      error: "Enter a valid US or Canadian mobile number, like (201) 555-9876.",
      field: "phone",
    };
  }

  const h = await headers();
  // Vercel puts the real client IP in x-forwarded-for; the first entry is the
  // client, the rest are proxies.
  const ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = h.get("user-agent")?.slice(0, 500) || null;

  // Match to an account if we can, but never require one — someone can opt
  // in from a number they've not added to their profile.
  //
  // Compared in normalised form rather than with a SQL match, because
  // profile numbers were typed freehand: the same number is stored as
  // "201-555-9876", "(201) 555-9876" and "+1 201 555 9876" across rows, and
  // none of those equal the E.164 we just built. The scan is over accounts
  // that have a number at all, which is a small fraction of a small table.
  const candidates = await db.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  const userId =
    candidates.find((c) => c.phone && toE164(c.phone) === phone)?.id ?? null;

  await db.$transaction(async (tx) => {
    await tx.smsConsentEvent.create({
      data: {
        action: "GRANTED",
        phone,
        // Snapshot, not a reference — see the model comment.
        consentText: SMS_CONSENT_TEXT,
        source: "web-form",
        ipAddress,
        userAgent,
        userId,
      },
    });

    // Keep the "can we text them right now?" flag in step with the log.
    if (userId) {
      await tx.user.update({
        where: { id: userId },
        data: { smsConsent: true, smsConsentAt: new Date(), phone },
      });
    }
  });

  // The confirmation text, sent straight after the opt-in. This is the one
  // message that deliberately bypasses sendToUser's consent lookup: consent
  // was just given, in this request, and for someone with no account there
  // is no user row to look it up from.
  //
  // Never fails the opt-in. The consent is recorded either way, and telling
  // someone their sign-up failed because a text didn't go out would be both
  // wrong and alarming.
  if (isConfigured()) {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const sent = await sendSms(phone, smsWelcome(appUrl));
    if (!sent.ok) console.error("Opt-in welcome text failed:", sent.error);
  }

  return { ok: true, phone };
}
