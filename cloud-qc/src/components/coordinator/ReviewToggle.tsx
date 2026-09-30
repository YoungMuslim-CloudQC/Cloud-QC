"use client";

import { useTransition } from "react";

import {
  markAllReviewed,
  markVisitReviewed,
  markVisitUnreviewed,
} from "@/server/actions/coordinator";

/** Per-card "I've read this". Optimism isn't worth it here — the click
 *  revalidates the page anyway, and a wrong tick is worse than a slow one.
 *
 *  `readOnly` is set when an admin is viewing as someone: the server would
 *  refuse the write regardless, so the control is disabled rather than left
 *  looking live and throwing on click. */
export function ReviewToggle({
  visitId,
  reviewed,
  readOnly = false,
}: {
  visitId: string;
  reviewed: boolean;
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();

  if (readOnly) {
    return (
      <span className="survey-time-note">
        {reviewed ? "They've read this" : "They haven't read this yet"}
      </span>
    );
  }

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

export function MarkAllReviewed({
  visitIds,
  readOnly = false,
}: {
  visitIds: string[];
  readOnly?: boolean;
}) {
  const [pending, start] = useTransition();
  if (visitIds.length === 0 || readOnly) return null;

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
