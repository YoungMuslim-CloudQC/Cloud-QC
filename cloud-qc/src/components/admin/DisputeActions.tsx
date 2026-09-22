"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  removeDisputedParticipant,
  resolveVisitDispute,
  reopenVisitDispute,
  notifyDisputeSubmitter,
  deleteVisit,
} from "@/server/actions/visits";

export function DisputeActions({
  disputeId,
  status,
  originalVisitId,
  ownVisitId,
  notified,
}: {
  disputeId: string;
  status: "PENDING" | "RESOLVED";
  originalVisitId: string;
  ownVisitId: string | null;
  notified: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  function run(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    setConfirming(null);
    startTransition(async () => {
      const res = await fn();
      setMsg(res.ok ? `${label} — done.` : (res.error ?? "Something went wrong."));
      router.refresh();
    });
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={pending}
          onClick={() => run("Removed from original visit", () => removeDisputedParticipant(disputeId))}
        >
          Remove them from the original visit
        </button>
        {confirming === "delete-original" ? (
          <>
            <button
              type="button"
              className="btn btn-reject btn-small"
              disabled={pending}
              onClick={() => run("Original visit deleted", () => deleteVisit(originalVisitId))}
            >
              Confirm delete original
            </button>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setConfirming(null)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-reject btn-small"
            disabled={pending}
            onClick={() => setConfirming("delete-original")}
          >
            Delete original visit
          </button>
        )}
        {ownVisitId &&
          (confirming === "delete-own" ? (
            <>
              <button
                type="button"
                className="btn btn-reject btn-small"
                disabled={pending}
                onClick={() => run("Their visit deleted", () => deleteVisit(ownVisitId))}
              >
                Confirm delete their visit
              </button>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setConfirming(null)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-reject btn-small"
              disabled={pending}
              onClick={() => setConfirming("delete-own")}
            >
              Delete their visit
            </button>
          ))}
        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={pending || notified}
          onClick={() => run("Notified", () => notifyDisputeSubmitter(disputeId))}
        >
          {notified ? "Notified ✓" : "Notify original submitter"}
        </button>
        {status === "PENDING" ? (
          <button
            type="button"
            className="btn btn-primary btn-small"
            style={{ width: "auto" }}
            disabled={pending}
            onClick={() => run("Marked resolved", () => resolveVisitDispute(disputeId))}
          >
            Mark resolved
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-small"
            disabled={pending}
            onClick={() => run("Reopened", () => reopenVisitDispute(disputeId))}
          >
            Reopen
          </button>
        )}
      </div>
      {msg && (
        <div className="survey-time-note" style={{ marginTop: 6 }}>
          {msg}
        </div>
      )}
    </div>
  );
}
