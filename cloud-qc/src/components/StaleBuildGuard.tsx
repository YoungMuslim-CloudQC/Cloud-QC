"use client";

import { useEffect } from "react";

import {
  clearStaleBuildGuard,
  isStaleBuildError,
  reloadForStaleBuild,
} from "@/lib/stale-build";

/**
 * Sits in the root layout and turns a deploy-under-an-open-tab into a
 * reload instead of a broken page.
 *
 * The error boundaries handle this too, but not every chunk failure reaches
 * them: one thrown while the router is prefetching, or from an async import
 * outside a render, surfaces as an unhandled rejection and leaves the page
 * half-working with nothing on screen to explain it. Listening at the window
 * catches those as well.
 */
export function StaleBuildGuard() {
  useEffect(() => {
    // Getting this far means the current build's chunks loaded, so any
    // guard left over from a previous reload has done its job.
    clearStaleBuildGuard();

    const onError = (e: ErrorEvent) => {
      if (isStaleBuildError(e.error) || isStaleBuildError({ message: e.message })) {
        reloadForStaleBuild();
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isStaleBuildError(e.reason)) reloadForStaleBuild();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
