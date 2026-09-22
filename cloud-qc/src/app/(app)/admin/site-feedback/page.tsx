import Link from "next/link";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/authz";
import { memberName } from "@/lib/queries";
import type { SiteFeedbackContext } from "@/lib/site-feedback";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";
import {
  deleteSiteFeedback,
  setSiteFeedbackStatus,
} from "@/server/actions/site-feedback";

export const dynamic = "force-dynamic";

const LIMIT = 100;

const when = (d: Date) =>
  d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/New_York",
  });

export default async function SiteFeedbackPage({
  searchParams,
}: PageProps<"/admin/site-feedback">) {
  await requireAdmin();
  const { status: statusParam } = await searchParams;
  const filter =
    statusParam === "RESOLVED" ? "RESOLVED" : statusParam === "ALL" ? "ALL" : "NEW";

  const [items, newCount, resolvedCount] = await Promise.all([
    db.siteFeedback.findMany({
      where: filter === "ALL" ? {} : { status: filter },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      // The screenshot itself is served separately (and lazily) by
      // /admin/site-feedback/<id>/screenshot — only flag whether it exists.
      select: {
        id: true,
        createdAt: true,
        status: true,
        path: true,
        problem: true,
        suggestion: true,
        context: true,
        author: { select: { name: true, email: true } },
      },
    }),
    db.siteFeedback.count({ where: { status: "NEW" } }),
    db.siteFeedback.count({ where: { status: "RESOLVED" } }),
  ]);
  const withShot = new Set(
    (
      await db.siteFeedback.findMany({
        where: { id: { in: items.map((i) => i.id) }, screenshot: { not: null } },
        select: { id: true },
      })
    ).map((r) => r.id),
  );

  const tab = (value: string, label: string, count?: number) => (
    <Link
      key={value}
      href={`/admin/site-feedback?status=${value}`}
      className={`status-opt${filter === value ? " sel-ok" : ""}`}
      style={{ textDecoration: "none" }}
    >
      {label}
      {count != null ? ` (${count})` : ""}
    </Link>
  );

  return (
    <>
      <BackLink href="/admin" label="Admin" />
      <PageHead
        title="Site feedback"
        desc="What members flagged on the site itself — with the part of the page they highlighted."
      />

      <div className="status-options" style={{ marginBottom: 16, maxWidth: 520 }}>
        {tab("NEW", "New", newCount)}
        {tab("RESOLVED", "Resolved", resolvedCount)}
        {tab("ALL", "All", newCount + resolvedCount)}
      </div>

      {items.length === 0 ? (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="empty-state">
            <strong>Nothing here</strong>
            {filter === "NEW"
              ? "No new site feedback. The “Improve this page” button on every page sends it here."
              : "No feedback in this view."}
          </div>
        </div>
      ) : (
        items.map((f) => {
          const ctx = (f.context ?? null) as SiteFeedbackContext | null;
          return (
            <div className="card" key={f.id} style={{ maxWidth: 720, marginBottom: 14 }}>
              <div className="section-label">
                <span>
                  {memberName(f.author)} &middot; {when(f.createdAt)}
                </span>
                <span
                  className={`badge ${f.status === "NEW" ? "badge-warn" : "badge-success"}`}
                >
                  {f.status === "NEW" ? "new" : "resolved"}
                </span>
              </div>

              <div className="sf-item-path">
                On <Link href={f.path}>{f.path}</Link>
              </div>

              <div className="sf-item-label">What&rsquo;s wrong</div>
              <div className="sf-item-body">{f.problem}</div>

              {f.suggestion && (
                <>
                  <div className="sf-item-label">How it could be better</div>
                  <div className="sf-item-body">{f.suggestion}</div>
                </>
              )}

              {ctx?.text && (
                <>
                  <div className="sf-item-label">Highlighted text</div>
                  <div className="sf-item-quote">{ctx.text}</div>
                </>
              )}

              {withShot.has(f.id) && (
                // eslint-disable-next-line @next/next/no-img-element -- admin-only route, not an optimizable static asset
                <img
                  className="sf-item-shot"
                  src={`/admin/site-feedback/${f.id}/screenshot`}
                  alt="Screenshot of the highlighted area"
                  loading="lazy"
                />
              )}

              <div className="sf-item-meta">
                {ctx?.selector && <code>{ctx.selector}</code>}
                {ctx?.viewport && (
                  <span>
                    {ctx.viewport.w}×{ctx.viewport.h}
                    {ctx.theme ? ` · ${ctx.theme} theme` : ""}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <form action={setSiteFeedbackStatus}>
                  <input type="hidden" name="id" value={f.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={f.status === "NEW" ? "RESOLVED" : "NEW"}
                  />
                  <button className="btn btn-secondary btn-small" type="submit">
                    {f.status === "NEW" ? "Mark resolved" : "Reopen"}
                  </button>
                </form>
                <form action={deleteSiteFeedback}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="btn btn-reject btn-small" type="submit">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          );
        })
      )}
      {items.length === LIMIT && (
        <div className="survey-time-note">Showing the latest {LIMIT}.</div>
      )}
    </>
  );
}
