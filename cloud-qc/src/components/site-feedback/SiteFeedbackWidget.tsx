"use client";

import { toCanvas } from "html-to-image";
import { useEffect, useRef, useState } from "react";

import { submitSiteFeedback } from "@/server/actions/site-feedback";
import { MAX_SCREENSHOT_CHARS, type SiteFeedbackContext } from "@/lib/site-feedback";

type Rect = { x: number; y: number; w: number; h: number }; // viewport px
type Phase = "idle" | "selecting" | "composing" | "sending";

const MIN_BOX = 14;
const IGNORE = "[data-sf-ignore]";
const BLANK_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function normalize(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

function intersects(a: DOMRect, r: Rect) {
  return a.right > r.x && a.left < r.x + r.w && a.bottom > r.y && a.top < r.y + r.h;
}

/** A short, human-readable path to an element — for the person reading the
 *  feedback to find it again. Not meant to be a stable selector. */
function cssPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body && parts.length < 5) {
    let part = cur.tagName.toLowerCase();
    if (cur.id) {
      parts.unshift(`${part}#${cur.id}`);
      break;
    }
    const cls = [...cur.classList]
      .filter((c) => !/^(css|_)|\d{3,}/.test(c))
      .slice(0, 2);
    if (cls.length) part += "." + cls.join(".");
    const parent: Element | null = cur.parentElement;
    if (parent) {
      const same = [...parent.children].filter((c) => c.tagName === cur!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
    }
    parts.unshift(part);
    cur = parent;
  }
  return parts.join(" > ");
}

/** The text actually visible inside the highlighted box. */
function visibleTextIn(rect: Rect): string {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set<string>();
  const out: string[] = [];
  let total = 0;
  const range = document.createRange();
  for (let n = walker.nextNode(); n && total < 600; n = walker.nextNode()) {
    const text = n.textContent?.replace(/\s+/g, " ").trim();
    const parent = n.parentElement;
    if (!text || !parent) continue;
    if (parent.closest(IGNORE) || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(parent.tagName)) continue;
    if (!intersects(parent.getBoundingClientRect(), rect)) continue;
    range.selectNodeContents(n);
    const hit = [...range.getClientRects()].some((r) => intersects(r, rect));
    if (hit && !seen.has(text)) {
      seen.add(text);
      out.push(text);
      total += text.length;
    }
  }
  return out.join(" · ").slice(0, 600);
}

function describe(rect: Rect | null): Pick<SiteFeedbackContext, "selector" | "text" | "rect"> {
  if (!rect) return {};
  const el = document
    .elementsFromPoint(rect.x + rect.w / 2, rect.y + rect.h / 2)
    .find(
      (e) =>
        !e.closest(IGNORE) && e !== document.documentElement && e !== document.body,
    );
  return {
    selector: el ? cssPath(el).slice(0, 400) : undefined,
    text: visibleTextIn(rect) || undefined,
    rect: {
      x: Math.round(rect.x + window.scrollX),
      y: Math.round(rect.y + window.scrollY),
      w: Math.round(rect.w),
      h: Math.round(rect.h),
    },
  };
}

/** Best-effort JPEG of the highlighted area (with some surrounding context).
 *  Resolves to undefined on any failure — the comment is still useful. */
async function captureScreenshot(rect: Rect | null): Promise<string | undefined> {
  try {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    const shot = await toCanvas(document.body, {
      width: vw,
      height: vh,
      pixelRatio: 1,
      imagePlaceholder: BLANK_PIXEL,
      backgroundColor:
        bodyBg && bodyBg !== "rgba(0, 0, 0, 0)" ? bodyBg : "#0d0821",
      // Shift normal-flow content up by the scroll offset, but leave fixed
      // elements (sidebar, tab bar) where they really are.
      style: {
        margin: "0",
        position: "relative",
        top: `${-window.scrollY}px`,
        left: `${-window.scrollX}px`,
      },
      filter: (node) =>
        !(
          node instanceof HTMLElement &&
          (node.hasAttribute("data-sf-ignore") ||
            node.tagName === "NEXTJS-PORTAL" ||
            node.tagName === "IFRAME")
        ),
    });

    const pad = 56;
    const crop = rect
      ? {
          x: Math.max(0, rect.x - pad),
          y: Math.max(0, rect.y - pad),
          w: 0,
          h: 0,
        }
      : { x: 0, y: 0, w: vw, h: vh };
    if (rect) {
      crop.w = Math.min(vw, rect.x + rect.w + pad) - crop.x;
      crop.h = Math.min(vh, rect.y + rect.h + pad) - crop.y;
    }

    const scale = Math.min(1, 900 / crop.w);
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(crop.w * scale));
    out.height = Math.max(1, Math.round(crop.h * scale));
    const ctx = out.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(shot, crop.x, crop.y, crop.w, crop.h, 0, 0, out.width, out.height);

    if (rect) {
      const bx = (rect.x - crop.x) * scale;
      const by = (rect.y - crop.y) * scale;
      ctx.fillStyle = "rgba(250, 204, 21, 0.16)";
      ctx.fillRect(bx, by, rect.w * scale, rect.h * scale);
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, rect.w * scale, rect.h * scale);
    }

    for (const quality of [0.8, 0.62, 0.45]) {
      const url = out.toDataURL("image/jpeg", quality);
      if (url.length <= MAX_SCREENSHOT_CHARS) return url;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export function SiteFeedbackWidget() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [rect, setRect] = useState<Rect | null>(null);
  const [problem, setProblem] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const origin = useRef<{ x: number; y: number } | null>(null);
  const capture = useRef<Promise<string | undefined> | null>(null);

  function reset() {
    setPhase("idle");
    setRect(null);
    setProblem("");
    setSuggestion("");
    setError(null);
    origin.current = null;
    capture.current = null;
  }

  // While the overlay is up, the page underneath must not scroll or the box
  // would drift off whatever it was drawn around.
  useEffect(() => {
    if (phase === "idle") return;
    const block = (e: Event) => e.preventDefault();
    window.addEventListener("wheel", block, { passive: false });
    window.addEventListener("touchmove", block, { passive: false });
    return () => {
      window.removeEventListener("wheel", block);
      window.removeEventListener("touchmove", block);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function beginCompose(box: Rect | null) {
    setRect(box);
    setPhase("composing");
    // Start the (slow) screenshot now so it's ready by the time they've typed.
    capture.current = captureScreenshot(box);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (phase !== "selecting") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    origin.current = { x: e.clientX, y: e.clientY };
    setRect({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (phase !== "selecting" || !origin.current) return;
    setRect(normalize(origin.current, { x: e.clientX, y: e.clientY }));
  }

  function onPointerUp(e: React.PointerEvent) {
    if (phase !== "selecting" || !origin.current) return;
    const box = normalize(origin.current, { x: e.clientX, y: e.clientY });
    origin.current = null;
    if (box.w >= MIN_BOX && box.h >= MIN_BOX) {
      beginCompose(box);
    } else {
      setRect(null); // just a tap — keep waiting for a real drag
    }
  }

  async function send() {
    if (problem.trim().length < 3) {
      setError("Tell us what's wrong first.");
      return;
    }
    setError(null);
    setPhase("sending");

    const shot = await Promise.race([
      capture.current ?? Promise.resolve(undefined),
      new Promise<undefined>((r) => setTimeout(() => r(undefined), 9000)),
    ]);

    const res = await submitSiteFeedback({
      path: window.location.pathname + window.location.search,
      problem: problem.trim(),
      suggestion: suggestion.trim() || undefined,
      context: {
        ...describe(rect),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        scrollY: Math.round(window.scrollY),
        userAgent: navigator.userAgent.slice(0, 400),
        theme: document.documentElement.dataset.theme,
      },
      screenshot: shot,
    }).catch(() => ({ ok: false as const, error: "Couldn't send — try again." }));

    if (res.ok) {
      reset();
      setToast("Thanks — your feedback was sent.");
    } else {
      setPhase("composing");
      setError(res.error);
    }
  }

  const panelOnTop =
    rect != null && typeof window !== "undefined"
      ? rect.y + rect.h / 2 > window.innerHeight / 2
      : false;

  return (
    <>
      {phase === "idle" && (
        <button
          type="button"
          className="sf-fab"
          data-sf-ignore
          onClick={() => setPhase("selecting")}
          aria-label="Give feedback about this page"
        >
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
            <path
              d="M4 4h16v12H8l-4 4V4z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>Improve this page</span>
        </button>
      )}

      {toast && (
        <div className="sf-toast" data-sf-ignore role="status">
          {toast}
        </div>
      )}

      {phase !== "idle" && (
        <div
          className={`sf-overlay${phase === "selecting" ? " is-selecting" : ""}`}
          data-sf-ignore
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            origin.current = null;
            setRect(null);
          }}
        >
          {phase === "selecting" && (
            <div className="sf-banner" onPointerDown={(e) => e.stopPropagation()}>
              <span>
                <strong>Drag over what you want to comment on.</strong>
                <span className="sf-banner-sub"> Swipe on a phone.</span>
              </span>
              <span className="sf-banner-actions">
                <button type="button" onClick={() => beginCompose(null)}>
                  Whole page
                </button>
                <button type="button" onClick={reset}>
                  Cancel
                </button>
              </span>
            </div>
          )}

          {rect && (
            <div
              className="sf-box"
              style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
            />
          )}

          {(phase === "composing" || phase === "sending") && (
            <div
              className={`sf-panel${panelOnTop ? " on-top" : ""}`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div className="sf-panel-title">
                {rect ? "Comment on the highlighted area" : "Comment on this page"}
              </div>
              <label htmlFor="sf-problem">What&rsquo;s wrong?</label>
              <textarea
                id="sf-problem"
                autoFocus
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="What's confusing, broken, or missing here?"
                disabled={phase === "sending"}
              />
              <label htmlFor="sf-suggestion">
                How could it be better? <span className="optional-tag">optional</span>
              </label>
              <textarea
                id="sf-suggestion"
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="What would you change?"
                disabled={phase === "sending"}
              />
              {error && <div className="field-error">{error}</div>}
              <div className="sf-panel-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  style={{ width: "auto" }}
                  onClick={send}
                  disabled={phase === "sending"}
                >
                  {phase === "sending" ? "Sending…" : "Send feedback"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => {
                    setRect(null);
                    setPhase("selecting");
                    capture.current = null;
                  }}
                  disabled={phase === "sending"}
                >
                  Redraw
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={reset}
                  disabled={phase === "sending"}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
