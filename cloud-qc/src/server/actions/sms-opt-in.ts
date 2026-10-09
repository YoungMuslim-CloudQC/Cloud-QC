"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { getSessionUser } from "@/lib/authz";
import { db } from "@/lib/db";
import { readOptInToken } from "@/lib/optin-token";
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
 * The page is public so anyone can read it — the disclosures are the opt-in
 * proof — but submitting requires proof of who is opting in: a session, or
 * a signed token from the invitation email. Everything else is treated as
 * hostile input: the number is re-validated server-side, and consent is
 * only ever taken from the submitted checkbox, never defaulted.
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

  // Whose account is this? Two sources, both of which actually prove it:
  //
  //  1. A live session — they're signed in.
  //  2. A signed token from their invitation email.
  //
  // An opt-in that can't be attached to an account is refused outright. It
  // would otherwise record a number nobody can be reached on, and the
  // person would never know: confirmation on screen, welcome text, then
  // silence forever.
  //
  // Matching on the typed number was deliberately dropped as an identity
  // source. It let anyone who knows a colleague's mobile opt that colleague
  // in — and, since opting in also writes the number onto the account,
  // redirect their neighbornet updates to a phone they don't own.
  let userId: string | null = null;

  const session = await getSessionUser();
  if (session) userId = session.id;

  if (!userId) {
    const token = formData.get("t");
    if (typeof token === "string" && token) {
      const fromToken = readOptInToken(token);
      if (fromToken) {
        const exists = await db.user.findUnique({
          where: { id: fromToken },
          select: { id: true },
        });
        userId = exists?.id ?? null;
      }
    }
  }

  if (!userId) {
    return {
      ok: false,
      error:
        "Sign in to Cloud QC first, then come back — we need to know whose account to attach this number to.",
    };
  }

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
    {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { notificationChannel: true },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          smsConsent: true,
          smsConsentAt: new Date(),
          phone,
          // Consent alone isn't enough to be reachable: sendToUser also
          // requires a channel that includes SMS, and the default is EMAIL.
          // Without this, someone opts in, sees a confirmation, and then
          // never receives anything — refused by our own gate for a reason
          // they were never shown.
          //
          // BOTH rather than SMS, because they asked to *also* get texts;
          // silently switching their email off is not what they agreed to.
          // Anyone who already chose SMS or BOTH keeps their choice.
          ...(current?.notificationChannel === "EMAIL"
            ? { notificationChannel: "BOTH" as const }
            : {}),
        },
      });
    }
  });

  // The confirmation text, sent straight after the opt-in. Deliberately
  // bypasses sendToUser's consent lookup: consent was given moments ago in
  // this same request, and re-reading it would race the write above.
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
