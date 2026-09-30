"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { drawMascot, randomCostume, SPRITE_H, SPRITE_W } from "@/lib/pixel-mascot";
import type { ReleaseNote } from "@/lib/changelog";
import { dismissWhatsNew } from "@/server/actions/changelog";

/** Slides up once, after a new release, to say what changed. The mascot
 *  walks on with it — same character as the error pages, so the app has one
 *  face rather than two.
 *
 *  Dismissing writes the release id to the account, so it stays dismissed
 *  on every device rather than coming back on the next machine they use. */
export function WhatsNew({ release }: { release: ReleaseNote }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx) drawMascot(ctx, randomCostume());
  }, []);

  function close() {
    setClosing(true);
    // Let the slide-out finish before the row disappears; the write itself
    // doesn't need waiting on.
    setTimeout(() => void dismissWhatsNew(release.id), 260);
  }

  return (
    <div className={`whatsnew${closing ? " closing" : ""}`} role="status">
      <canvas
        ref={canvas}
        className="whatsnew-sprite"
        width={SPRITE_W}
        height={SPRITE_H}
        aria-hidden="true"
      />

      <div className="whatsnew-body">
        <div className="whatsnew-eyebrow">New in Cloud QC</div>
        <div className="whatsnew-title">{release.title}</div>
        <ul className="whatsnew-list">
          {release.items.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {release.items.length > 3 && (
          <Link className="whatsnew-more" href="/whats-new">
            and {release.items.length - 3} more →
          </Link>
        )}
      </div>

      <button type="button" className="whatsnew-close" onClick={close}>
        Got it
      </button>
    </div>
  );
}
