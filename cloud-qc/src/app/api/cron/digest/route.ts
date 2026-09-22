import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { buildDigestContent, digestEmailHtml, isDigestDue } from "@/lib/digest";
import { sendDigestEmail } from "@/lib/resend";
import { memberName } from "@/lib/queries";

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
      role: { not: "COORDINATOR" },
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

  const results: { userId: string; email: string; outcome: string }[] = [];

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
      if (sent.ok) {
        await db.user.update({
          where: { id: u.id },
          data: { lastDigestSentAt: now },
        });
        results.push({ userId: u.id, email: u.email, outcome: "sent" });
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
    checked: candidates.length,
    due: results.length,
    sent: results.filter((r) => r.outcome === "sent").length,
    results,
  });
}
