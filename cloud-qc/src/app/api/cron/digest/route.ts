import { QC_MEMBER_WHERE } from "@/lib/role-access";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildDigestContent, digestEmailHtml, isDigestDue } from "@/lib/digest";
import { buildCoordinatorDigestContent } from "@/lib/coordinator-digest";
import { sendDigestEmail } from "@/lib/resend";
import { memberName } from "@/lib/queries";
import { sendToUser } from "@/lib/sms-send";
import { smsDigest } from "@/lib/sms-templates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // refuse to run wide open if misconfigured
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true; // how Vercel Cron calls this
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret; // manual/local testing
}

/** Run daily by Vercel Cron (see vercel.json). Checks every user whose
 *  digest cadence isn't OFF, sends the ones that are due, and records
 *  lastDigestSentAt only on a successful send so a transient failure
 *  retries next run instead of being silently skipped for a whole period. */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const now = new Date();

  const candidates = await db.user.findMany({
    where: {
      status: "APPROVED",
      ...QC_MEMBER_WHERE,
      digestCadence: { not: "OFF" },
    },
    select: {
      id: true,
      name: true,
      email: true,
      digestCadence: true,
      lastDigestSentAt: true,
    },
  });

  const results: { userId: string; email: string; outcome: string; sms?: string }[] = [];

  for (const u of candidates) {
    if (u.digestCadence === "OFF") continue; // narrows the type for TS below
    if (!isDigestDue(u.digestCadence, u.lastDigestSentAt, now)) continue;

    try {
      const content = await buildDigestContent(
        u.id,
        u.digestCadence,
        u.lastDigestSentAt,
      );
      const { subject, html } = digestEmailHtml(content, {
        firstName: memberName(u).split(" ")[0] ?? "there",
        appUrl,
      });
      const sent = await sendDigestEmail({ to: u.email, subject, html });

      // The text is a second delivery of the same digest, not a different
      // message. sendToUser decides whether it's allowed — if they picked
      // email only, or never consented, it declines and says why.
      const text = await sendToUser(
        u.id,
        smsDigest({
          firstName: memberName(u).split(" ")[0] ?? "there",
          attentionCount: content.attention.length,
          onTrackCount: content.onTrackNames.length,
          appUrl,
        }),
      );

      if (sent.ok) {
        await db.user.update({
          where: { id: u.id },
          data: { lastDigestSentAt: now },
        });
        results.push({
          userId: u.id,
          email: u.email,
          outcome: "sent",
          sms: text.ok ? "sent" : text.reason,
        });
      } else {
        results.push({ userId: u.id, email: u.email, outcome: `failed: ${sent.error}` });
      }
    } catch (err) {
      results.push({
        userId: u.id,
        email: u.email,
        outcome: `error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  // --- Coordinator-side accounts ---
  // A separate pass because QC_MEMBER_WHERE above deliberately excludes
  // them, and their content is built differently: scoped by their role
  // assignments rather than the profile sub-area fields they never set,
  // and always covering a trimester however often it's sent.
  const coordinators = await db.user.findMany({
    where: {
      status: "APPROVED",
      digestCadence: { not: "OFF" },
      roleAssignments: {
        some: { roleType: { in: ["COORDINATOR", "SR_COORDINATOR", "CORE_TEAM"] } },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      digestCadence: true,
      lastDigestSentAt: true,
    },
  });

  for (const u of coordinators) {
    if (u.digestCadence === "OFF") continue;
    if (!isDigestDue(u.digestCadence, u.lastDigestSentAt, now)) continue;

    try {
      const content = await buildCoordinatorDigestContent(u.id);
      const { subject, html } = digestEmailHtml(content, {
        firstName: memberName(u).split(" ")[0] ?? "there",
        appUrl,
      });
      const sent = await sendDigestEmail({ to: u.email, subject, html });
      const text = await sendToUser(
        u.id,
        smsDigest({
          firstName: memberName(u).split(" ")[0] ?? "there",
          attentionCount: content.attention.length,
          onTrackCount: content.onTrackNames.length,
          appUrl,
        }),
      );
      if (sent.ok) {
        await db.user.update({
          where: { id: u.id },
          data: { lastDigestSentAt: now },
        });
        results.push({
          userId: u.id,
          email: u.email,
          outcome: "sent",
          sms: text.ok ? "sent" : text.reason,
        });
      } else {
        results.push({ userId: u.id, email: u.email, outcome: `failed: ${sent.error}` });
      }
    } catch (err) {
      results.push({
        userId: u.id,
        email: u.email,
        outcome: `error: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
  }

  return NextResponse.json({
    checked: candidates.length + coordinators.length,
    due: results.length,
    sent: results.filter((r) => r.outcome === "sent").length,
    results,
  });
}
