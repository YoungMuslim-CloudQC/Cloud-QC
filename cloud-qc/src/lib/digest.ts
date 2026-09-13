import "server-only";

import { db } from "@/lib/db";
import { hysteresisStatus } from "@/lib/neighbornet-status";
import { isoDate } from "@/lib/format";
import type { DigestCadence } from "@prisma/client";

export const CADENCE_DAYS: Record<Exclude<DigestCadence, "OFF">, number> = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
};

const SEVERITY: Record<string, number> = { URGENT: 2, NEEDS_FOLLOWUP: 1 };

export type DigestAttentionLine = {
  id: string;
  name: string;
  status: "NEEDS_FOLLOWUP" | "URGENT";
  lastVisitDate: string | null;
  lastVisitNote: string | null;
};

export type DigestContent = {
  attention: DigestAttentionLine[];
  onTrackNames: string[];
  yourVisitCount: number;
  periodLabel: string;
};

/** Is this user due for a digest right now, given their cadence and the
 *  last time one actually went out? OFF is never due. A never-sent user is
 *  due immediately — that's how a freshly-turned-on preference gets its
 *  first email instead of waiting a full period. */
export function isDigestDue(
  cadence: DigestCadence,
  lastSentAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (cadence === "OFF") return false;
  if (!lastSentAt) return true;
  const days = CADENCE_DAYS[cadence];
  const elapsedMs = now.getTime() - lastSentAt.getTime();
  return elapsedMs >= days * 24 * 60 * 60 * 1000;
}

/** Builds one user's digest content. `since` bounds "your activity" — pass
 *  their lastDigestSentAt, or null for a first-ever send (falls back to one
 *  cadence period back so it isn't empty). Neighbornet status is always the
 *  live current picture, not bounded by `since`. */
export async function buildDigestContent(
  userId: string,
  cadence: Exclude<DigestCadence, "OFF">,
  since: Date | null,
): Promise<DigestContent> {
  const effectiveSince =
    since ?? new Date(Date.now() - CADENCE_DAYS[cadence] * 24 * 60 * 60 * 1000);

  const [neighbornets, yourVisitCount] = await Promise.all([
    db.neighbornet.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        visits: {
          where: { deletedAt: null },
          orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
          select: { visitDate: true, status: true, notes: true },
        },
      },
    }),
    db.visitParticipant.count({
      where: {
        userId,
        visit: { deletedAt: null, createdAt: { gte: effectiveSince } },
      },
    }),
  ]);

  const attention: DigestAttentionLine[] = [];
  const onTrackNames: string[] = [];

  for (const n of neighbornets) {
    const status = hysteresisStatus(n.visits);
    const latest = n.visits[0] ?? null;
    if (status === "NEEDS_FOLLOWUP" || status === "URGENT") {
      attention.push({
        id: n.id,
        name: n.name,
        status,
        lastVisitDate: latest ? isoDate(latest.visitDate) : null,
        lastVisitNote: latest?.notes ?? null,
      });
    } else {
      onTrackNames.push(n.name);
    }
  }
  attention.sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status]);

  const periodLabel =
    cadence === "WEEKLY" ? "This week" : cadence === "BIWEEKLY" ? "The last two weeks" : "This month";

  return { attention, onTrackNames, yourVisitCount, periodLabel };
}

const STATUS_META = {
  URGENT: { emoji: "\u{1F534}", label: "Urgent" },
  NEEDS_FOLLOWUP: { emoji: "\u{1F7E1}", label: "Needs follow-up" },
} as const;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Plain-inline-styled HTML — no build step / template engine, so it can be
 *  sent straight through Resend without a React Email dependency. */
export function digestEmailHtml(
  content: DigestContent,
  opts: { firstName: string; appUrl: string },
): { subject: string; html: string } {
  const { attention, onTrackNames, yourVisitCount, periodLabel } = content;
  const subject =
    attention.length > 0
      ? `Cloud QC Digest — ${attention.length} neighbornet${attention.length === 1 ? "" : "s"} need${attention.length === 1 ? "s" : ""} attention`
      : "Cloud QC Digest — all neighbornets on track";

  const attentionHtml = attention.length
    ? attention
        .map((a) => {
          const meta = STATUS_META[a.status];
          const note = a.lastVisitNote
            ? `<div style="color:#948CBB;font-size:13px;margin-top:4px;">"${escapeHtml(
                a.lastVisitNote.slice(0, 140),
              )}${a.lastVisitNote.length > 140 ? "…" : ""}"</div>`
            : "";
          return `
        <div style="padding:12px 0;border-bottom:1px solid #2c2258;">
          <div style="font-weight:700;font-size:14px;color:#ede9fe;">
            ${meta.emoji} ${meta.label} — ${escapeHtml(a.name)}
          </div>
          <div style="color:#948CBB;font-size:12.5px;margin-top:2px;">
            Last visit: ${a.lastVisitDate ?? "—"}
          </div>
          ${note}
        </div>`;
        })
        .join("")
    : `<div style="padding:12px 0;color:#34d399;font-weight:600;">Everything's on track — nothing needs attention right now.</div>`;

  const onTrackHtml = onTrackNames.length
    ? `<div style="padding:12px 0;color:#948CBB;font-size:13px;">
        ${escapeHtml(onTrackNames.join(", "))} (${onTrackNames.length} neighbornet${onTrackNames.length === 1 ? "" : "s"}, no action needed)
      </div>`
    : "";

  const html = `
  <div style="background:#0d0821;padding:32px 16px;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#170f32;border:1px solid #2c2258;border-radius:14px;padding:28px;">
      <div style="font-weight:700;font-size:19px;color:#c4b5fd;margin-bottom:4px;">☁ Cloud QC</div>
      <div style="color:#948CBB;font-size:12.5px;margin-bottom:20px;">Young Muslim · QC Ops</div>

      <div style="color:#ede9fe;font-size:14px;margin-bottom:20px;">
        Hi ${escapeHtml(opts.firstName)}, here's your ${periodLabel.toLowerCase()} neighbornet summary.
      </div>

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#fbbf24;margin-bottom:6px;">
        Needs attention (${attention.length})
      </div>
      ${attentionHtml}

      ${
        onTrackNames.length
          ? `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#34d399;margin:20px 0 6px 0;">
              On track (${onTrackNames.length})
            </div>
            ${onTrackHtml}`
          : ""
      }

      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#38bdf8;margin:20px 0 6px 0;">
        Your activity — ${periodLabel.toLowerCase()}
      </div>
      <div style="color:#ede9fe;font-size:13px;">
        You submitted or co-visited ${yourVisitCount} visit${yourVisitCount === 1 ? "" : "s"}.
      </div>

      <a href="${opts.appUrl}/dashboard"
         style="display:inline-block;margin-top:24px;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;font-size:13.5px;padding:10px 18px;border-radius:7px;">
        Open Cloud QC dashboard
      </a>

      <div style="color:#5f5789;font-size:10.5px;margin-top:24px;line-height:1.5;">
        Change your digest frequency anytime from your profile settings in Cloud QC.
      </div>
    </div>
  </div>`;

  return { subject, html };
}
