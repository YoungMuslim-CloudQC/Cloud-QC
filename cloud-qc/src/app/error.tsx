"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PixelMascot } from "@/components/PixelMascot";
import { isStaleBuildError, reloadForStaleBuild } from "@/lib/stale-build";

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
  const stale = isStaleBuildError(error);

  useEffect(() => {
    if (stale) {
      // A chunk went missing because the build changed underneath this tab.
      // reset() re-renders against the same missing file and so can never
      // succeed; only re-fetching the HTML gets the new chunk names. The
      // guard inside refuses a second attempt, and then the copy below —
      // which is written to read correctly either way — is what's left.
      reloadForStaleBuild();
      return;
    }
    // Nothing collects these yet — when error monitoring goes in, this is
    // the hook it plugs into. Until then the console is better than silence.
    console.error("Page error:", error);
  }, [error, stale]);

  return (
    <div className="oops">
      <PixelMascot />
      <h1 className="oops-title">
        {stale ? "Cloud QC was updated" : "Well, that didn’t work"}
      </h1>
      <p className="oops-sub">
        {stale
          ? "This tab is running an older version, so part of the page is no longer available. Reloading picks up the new one."
          : "Something broke on our end loading this page — not you. Try again, and if it keeps happening, leave a note with “Improve this page” so we can see what went wrong."}
      </p>
      {error.digest && <div className="oops-code">ref: {error.digest}</div>}
      <div className="oops-actions">
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: "auto" }}
          onClick={() => (stale ? window.location.reload() : reset())}
        >
          {stale ? "Reload" : "Try again"}
        </button>
        <Link className="btn btn-secondary" href="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
