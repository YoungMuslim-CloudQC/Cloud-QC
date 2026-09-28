"use client";

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
          <div
            className="ge-sprite"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: "url(/pixel-karim.png)",
              backgroundSize: "contain",
              backgroundPosition: "bottom center",
              backgroundRepeat: "no-repeat",
              imageRendering: "pixelated",
              animation: "ge-bob 2.6s ease-in-out infinite",
            }}
          />
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "10px 0 0" }}>
          Cloud QC fell over
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
          Something failed before the app could even start drawing. Reloading
          usually clears it.
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
          onClick={reset}
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
