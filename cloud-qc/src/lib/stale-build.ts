/** Every deploy renames the JS chunks. A tab that was already open keeps
 *  asking for the old names, which are gone the moment the new build goes
 *  live — so the app breaks for whoever was mid-session while it worked
 *  perfectly for anyone loading it fresh.
 *
 *  This is worth special-casing because the normal error recovery is
 *  actively wrong for it: re-rendering asks for the same missing file
 *  again, so "Try again" can never succeed. Only a hard reload can, because
 *  that re-fetches the HTML and with it the new chunk names. */
export function isStaleBuildError(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; message?: string };
  const name = e.name ?? "";
  const message = e.message ?? "";
  return (
    name === "ChunkLoadError" ||
    /ChunkLoadError|Loading chunk \d+ failed|Failed to load chunk|Importing a module script failed|error loading dynamically imported module/i.test(
      message,
    )
  );
}

const RELOAD_KEY = "cqc:stale-reload";

/**
 * Reload once to pick up the new build.
 *
 * Guarded by sessionStorage so a failure that merely looks like a stale
 * chunk — a dead CDN, an offline device, a chunk that genuinely 404s in the
 * current build — can't put the tab in a reload loop. On the second attempt
 * we give up and let the error screen stay put, which is at least readable.
 *
 * Returns true if a reload was actually triggered.
 */
export function reloadForStaleBuild(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Private mode, blocked storage — without the guard a loop is possible,
    // so do nothing rather than risk one.
    return false;
  }
  window.location.reload();
  return true;
}

/** Called once the app renders successfully, so the next stale deploy gets
 *  its own reload rather than being refused by a stale guard. */
export function clearStaleBuildGuard(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {
    // nothing to clear if storage is unavailable
  }
}
