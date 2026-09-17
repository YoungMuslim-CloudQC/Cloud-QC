"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteVisit } from "@/server/actions/visits";

export function SubmissionRowActions({ visitId }: { visitId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const res = await deleteVisit(visitId);
      if (res.ok) {
        setConfirming(false);
        router.refresh();
      } else {
        setError("error" in res ? res.error : "Something went wrong.");
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <Link className="btn btn-secondary btn-small" href={`/feedback?edit=${visitId}`}>
          Edit
        </Link>
        {confirming ? (
          <>
            <button
              type="button"
              className="btn btn-reject btn-small"
              disabled={pending}
              onClick={handleDelete}
            >
              {pending ? "…" : "Confirm"}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={pending}
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
      </div>
      {error && (
        <div style={{ fontSize: 11, color: "var(--urgent)" }}>{error}</div>
      )}
    </div>
  );
}
