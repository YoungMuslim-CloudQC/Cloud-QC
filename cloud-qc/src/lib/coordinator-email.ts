import "server-only";

import { db } from "@/lib/db";
import { isoDate, statusMeta } from "@/lib/format";
import { memberName } from "@/lib/queries";
import { sendDigestEmail } from "@/lib/resend";
import { EVENT_TYPE_LABEL } from "@/lib/visit-schema";

/**
 * Emailing coordinators when feedback lands is opt-in twice over: the
 * COORDINATOR_EMAILS_ENABLED flag must be "true" AND the code must be running
 * on the production deployment. Local dev and Vercel previews share the
 * production database, so without the second condition a test submission
 * could email a real coordinator.
 */
export function coordinatorEmailsEnabled(): boolean {
  return (
    process.env.COORDINATOR_EMAILS_ENABLED === "true" &&
    process.env.VERCEL_ENV === "production"
  );
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Best-effort: never throws, never blocks logging the visit. */
export async function notifyCoordinators(visitId: string): Promise<void> {
  if (!coordinatorEmailsEnabled()) return;
  try {
    const visit = await db.visit.findUnique({
      where: { id: visitId },
      include: {
        submittedBy: { select: { name: true, email: true } },
        neighbornet: {
          select: {
            name: true,
            coordinators: {
              select: {
                user: { select: { email: true, name: true, role: true, status: true } },
              },
            },
          },
        },
      },
    });
    if (!visit || visit.deletedAt) return;

    const recipients = visit.neighbornet.coordinators
      .map((c) => c.user)
      .filter((u) => u.role === "COORDINATOR" && u.status === "APPROVED");
    if (recipients.length === 0) return;

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const meta = statusMeta(visit.status);
    const kind =
      visit.eventType === "VISIT" ? "visit" : EVENT_TYPE_LABEL[visit.eventType].toLowerCase();
    const subject = `New QC feedback for ${visit.neighbornet.name}`;

    for (const to of recipients) {
      const html = `
  <div style="background:#0d0821;padding:32px 16px;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#170f32;border:1px solid #2c2258;border-radius:14px;padding:28px;">
      <div style="font-weight:700;font-size:19px;color:#c4b5fd;margin-bottom:4px;">☁ Cloud QC</div>
      <div style="color:#948CBB;font-size:12.5px;margin-bottom:20px;">Young Muslim · QC Ops</div>
      <div style="color:#ede9fe;font-size:14px;margin-bottom:12px;">
        Hi ${esc((to.name ?? "there").split(" ")[0])}, ${esc(memberName(visit.submittedBy))} logged a ${esc(kind)} for
        <strong>${esc(visit.neighbornet.name)}</strong> on ${isoDate(visit.visitDate)}${visit.status ? ` — ${esc(meta.label)}` : ""}.
      </div>
      <div style="color:#ede9fe;font-size:13.5px;border-left:2px solid #2c2258;padding-left:12px;white-space:pre-wrap;">${esc(visit.notes)}</div>
      <a href="${appUrl}/coordinator"
         style="display:inline-block;margin-top:24px;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;font-size:13.5px;padding:10px 18px;border-radius:7px;">
        Open your feedback inbox
      </a>
    </div>
  </div>`;
      await sendDigestEmail({ to: to.email, subject, html });
    }
  } catch {
    // Feedback is already saved; a failed notification must not undo that.
  }
}
