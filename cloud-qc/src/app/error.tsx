"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PixelMascot } from "@/components/PixelMascot";

/** Shown when a page throws. Replaces Next's bare "a server error occurred"
 *  screen — same information, but it looks like the rest of Cloud QC and
 *  gives you somewhere to go instead of a dead end. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Nothing collects these yet — when error monitoring goes in, this is
    // the hook it plugs into. Until then the console is better than silence.
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="oops">
      <PixelMascot />
      <h1 className="oops-title">Well, that didn&rsquo;t work</h1>
      <p className="oops-sub">
        Something broke on our end loading this page — not you. Try again, and
        if it keeps happening, leave a note with &ldquo;Improve this page&rdquo;
        so we can see what went wrong.
      </p>
      {error.digest && <div className="oops-code">ref: {error.digest}</div>}
      <div className="oops-actions">
        <button type="button" className="btn btn-primary" style={{ width: "auto" }} onClick={reset}>
          Try again
        </button>
        <Link className="btn btn-secondary" href="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
