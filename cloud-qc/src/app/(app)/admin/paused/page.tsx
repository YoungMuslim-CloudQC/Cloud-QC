import Link from "next/link";

import { requireApprovedAny } from "@/lib/authz";
import { redirect } from "next/navigation";
import { stopViewAs } from "@/server/actions/view-as";

export const dynamic = "force-dynamic";

/**
 * Where an admin lands if they open an admin page while still viewing as
 * someone else.
 *
 * The admin screens genuinely can't run in that mode — they'd be acting as
 * the borrowed account — but the old behaviour was a silent redirect to
 * /coordinator, which looks exactly like the Admin page being broken. One
 * sentence and a button that gets them back is the whole fix.
 */
export default async function AdminPausedPage() {
  const me = await requireApprovedAny();

  // Nothing to explain if view-as already ended — the hour ran out, or they
  // stopped it in another tab. Send them where they were headed.
  if (!me.impersonating) redirect("/admin");

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <div className="section-label">
        <span>Admin is paused</span>
      </div>

      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text)", margin: "0 0 12px" }}>
        You&rsquo;re currently viewing Cloud QC as{" "}
        <strong>{me.impersonating.viewingName}</strong>, so the admin screens
        are unavailable — everything in this mode is read-only, and admin
        actions would be attributed to the account you&rsquo;re borrowing.
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--muted)", margin: "0 0 18px" }}>
        Stop viewing to get your own navigation, the Admin page and the full
        org map back. View-as also ends on its own an hour after it started.
      </p>

      <div className="oops-actions" style={{ justifyContent: "flex-start" }}>
        <form action={stopViewAs}>
          <input type="hidden" name="next" value="/admin" />
          <button type="submit" className="btn btn-primary" style={{ width: "auto" }}>
            Stop viewing and open Admin
          </button>
        </form>
        <Link className="btn btn-secondary" href="/coordinator">
          Keep viewing as {me.impersonating.viewingName}
        </Link>
      </div>
    </div>
  );
}
