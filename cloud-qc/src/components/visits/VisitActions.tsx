"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteVisit, restoreVisit } from "@/server/actions/visits";

export function VisitActions({
  visitId,
  deleted,
  canModify,
}: {
  visitId: string;
  deleted: boolean;
  canModify: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (!canModify) return null;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div style={{ marginTop: 8 }}>
      {error && (
        <div className="auth-msg error" style={{ maxWidth: 420 }}>
          {error}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {deleted ? (
          <button
            type="button"
            className="btn btn-primary btn-small"
            style={{ width: "auto" }}
            disabled={pending}
            onClick={() => run(() => restoreVisit(visitId))}
          >
            {pending ? "Restoring…" : "Restore visit"}
          </button>
        ) : (
          <>
            <Link
              className="btn btn-secondary btn-small"
              href={`/feedback?edit=${visitId}`}
            >
              Edit
            </Link>
            {confirming ? (
              <>
                <button
                  type="button"
                  className="btn btn-reject btn-small"
                  disabled={pending}
                  onClick={() => run(() => deleteVisit(visitId))}
                >
                  {pending ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => setConfirming(false)}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-reject btn-small"
                onClick={() => setConfirming(true)}
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
