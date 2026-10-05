import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { recordOptOut } from "@/lib/sms-send";
import { toE164 } from "@/lib/phone";
import { db } from "@/lib/db";
import { smsHelpReply } from "@/lib/sms-templates";
import { SMS_CONSENT_TEXT } from "@/lib/sms-consent-copy";

export const dynamic = "force-dynamic";

/**
 * Inbound SMS from Twilio.
 *
 * Twilio's Messaging Service already handles STOP/HELP at the carrier level
 * — it will stop delivering to a number that opts out whether or not this
 * endpoint exists. This is here so *our* record agrees with Twilio's: if
 * someone replies STOP and our database still says smsConsent = true, every
 * later send is an attempt to message someone who opted out, and the only
 * reason it doesn't reach them is Twilio catching it. That gap is exactly
 * what a complaint investigation looks at.
 */

/** Twilio signs every request with the auth token. Without checking it,
 *  anyone who finds this URL could opt arbitrary numbers in or out. */
function isFromTwilio(url: string, params: Record<string, string>, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;

  // Twilio's scheme: the full URL, then each POST param appended as
  // key+value in alphabetical order, HMAC-SHA1'd with the auth token.
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join("");
  const expected = createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function twiml(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);

  // Behind Vercel the request URL Twilio signed is the public https one,
  // which is not always what req.url reports.
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const publicUrl = `${proto}://${host}/api/sms/inbound`;

  if (!isFromTwilio(publicUrl, params, req.headers.get("x-twilio-signature"))) {
    return NextResponse.json({ error: "Bad signature" }, { status: 403 });
  }

  const from = params.From ?? "";
  const bodyText = (params.Body ?? "").trim().toUpperCase();

  // The keywords carriers require every sender to honour.
  const STOP_WORDS = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"];
  const START_WORDS = ["START", "YES", "UNSTOP"];

  if (STOP_WORDS.includes(bodyText)) {
    await recordOptOut(from, "sms-stop");
    // Twilio's own STOP handling sends its confirmation, so returning one
    // here too would send two. Record it and stay quiet.
    return twiml();
  }

  if (bodyText === "HELP" || bodyText === "INFO") {
    return twiml(smsHelpReply());
  }

  if (START_WORDS.includes(bodyText)) {
    const phone = toE164(from);
    if (phone) {
      const candidates = await db.user.findMany({
        where: { phone: { not: null } },
        select: { id: true, phone: true },
      });
      const match = candidates.find((c) => c.phone && toE164(c.phone) === phone);

      await db.smsConsentEvent.create({
        data: {
          action: "GRANTED",
          phone,
          // What they actually agreed to is the wording they saw when they
          // first opted in; a START is a re-confirmation of that, so the
          // same text is the honest thing to record.
          consentText: SMS_CONSENT_TEXT,
          source: "sms-start",
          userId: match?.id ?? null,
        },
      });
      if (match) {
        await db.user.update({
          where: { id: match.id },
          data: { smsConsent: true, smsConsentAt: new Date() },
        });
      }
    }
    return twiml();
  }

  // Anything else: this isn't a conversational service, and replying to
  // free text would invite one. Silence is the correct answer.
  return twiml();
}

/** Twilio hits this with GET when you click "Test" in the console. */
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "sms-inbound" });
}

