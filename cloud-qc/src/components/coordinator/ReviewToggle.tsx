"use client";

import { useTransition } from "react";

import {
  markAllReviewed,
  markVisitReviewed,
  markVisitUnreviewed,
} from "@/server/actions/coordinator";

/** Per-card "I've read this". Optimism isn't worth it here — the click
 *  revalidates the page anyway, and a wrong tick is worse than a slow one. */
export function ReviewToggle({
  visitId,
  reviewed,
}: {
  visitId: string;
  reviewed: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      className={`btn btn-small ${reviewed ? "btn-secondary" : "btn-primary"}`}
      style={{ width: "auto" }}
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (reviewed) await markVisitUnreviewed(visitId);
          else await markVisitReviewed(visitId);
        })
      }
    >
      {pending ? "Saving…" : reviewed ? "Reviewed ✓" : "Mark reviewed"}
    </button>
  );
}

export function MarkAllReviewed({ visitIds }: { visitIds: string[] }) {
  const [pending, start] = useTransition();
  if (visitIds.length === 0) return null;

  return (
    <button
      type="button"
      className="btn btn-secondary btn-small"
      style={{ width: "auto" }}
      disabled={pending}
      onClick={() => start(async () => void (await markAllReviewed(visitIds)))}
    >
      {pending ? "Marking…" : `Mark all ${visitIds.length} reviewed`}
    </button>
  );
}
