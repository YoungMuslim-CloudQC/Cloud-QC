"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { toggleFeedbackSent } from "@/server/actions/visits";

export function FeedbackSentToggle({
  visitId,
  sent,
}: {
  visitId: string;
  sent: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={`btn-toggle${sent ? " on" : ""}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await toggleFeedbackSent(visitId);
          router.refresh();
        })
      }
    >
      {sent ? "Sent" : "Not sent"}
    </button>
  );
}
