"use client";

import { useEffect, useRef } from "react";

import {
  drawMascot,
  randomCostume,
  SPRITE_H,
  SPRITE_W,
} from "@/lib/pixel-mascot";
import { isStaleBuildError, reloadForStaleBuild } from "@/lib/stale-build";

/**
 * The last line of defence: this replaces the root layout, so it renders its
 * own <html>/<body> and can't assume globals.css or the theme variables ever
 * loaded. Everything here is therefore inline and self-contained — if the
 * stylesheet itself is what failed, this page still looks deliberate.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stale = isStaleBuildError(error);

  // Outfit chosen inside the effect, never during render, so the server and
  // the browser can't disagree about which one it is.
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (ctx) drawMascot(ctx, randomCostume());
  }, []);

  // A deploy landed under this tab and took the chunks with it. reset()
  // can't recover from that; only re-fetching the HTML can.
  useEffect(() => {
    if (stale) reloadForStaleBuild();
  }, [stale]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          textAlign: "center",
          padding: "32px 16px",
          background: "#0d0821",
          color: "#ede9fe",
          fontFamily: "Inter, system-ui, -apple-system, Arial, sans-serif",
        }}
      >
        <style>{`
          @keyframes ge-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }
          @keyframes ge-shadow {
            0%,100% { transform: scaleX(1); opacity: .42 }
            50% { transform: scaleX(.82); opacity: .26 }
          }
          @media (prefers-reduced-motion: reduce) {
            .ge-sprite, .ge-shadow { animation: none !important }
          }
        `}</style>

        <div style={{ position: "relative", width: 150, height: 250, marginBottom: 8 }} aria-hidden="true">
          <div
            className="ge-shadow"
            style={{
              position: "absolute",
              left: "50%",
              bottom: -6,
              width: 86,
              height: 12,
              marginLeft: -43,
              borderRadius: "50%",
              background: "rgba(0,0,0,.42)",
              filter: "blur(3px)",
              animation: "ge-shadow 2.6s ease-in-out infinite",
            }}
          />
          <canvas
            ref={ref}
            className="ge-sprite"
            width={SPRITE_W}
            height={SPRITE_H}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              imageRendering: "pixelated",
              objectFit: "contain",
              objectPosition: "bottom center",
              animation: "ge-bob 2.6s ease-in-out infinite",
            }}
          />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "10px 0 0" }}>
          {stale ? "Cloud QC was updated" : "Cloud QC fell over"}
        </h1>
        <p
          style={{
            fontSize: 13.5,
            color: "#948CBB",
            maxWidth: 420,
            lineHeight: 1.55,
            margin: "6px 0 0",
          }}
        >
          {stale
            ? "This tab is running an older version. Reloading picks up the new one."
            : "Something failed before the app could even start drawing. Reloading usually clears it."}
        </p>
        {error.digest && (
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 11,
              color: "#948CBB",
              opacity: 0.7,
              marginTop: 10,
            }}
          >
            ref: {error.digest}
          </div>
        )}
        <button
          type="button"
          onClick={() => (stale ? window.location.reload() : reset())}
          style={{
            marginTop: 18,
            background: "#7c3aed",
            color: "#fff",
            border: "none",
            fontWeight: 600,
            fontSize: 13.5,
            padding: "10px 18px",
            borderRadius: 7,
            cursor: "pointer",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
