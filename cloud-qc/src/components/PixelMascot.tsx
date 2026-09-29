"use client";

import { useEffect, useRef } from "react";

import {
  drawMascot,
  randomCostume,
  SPRITE_H,
  SPRITE_W,
} from "@/lib/pixel-mascot";

/** The pixel mascot on the error and not-found pages: a slow idle bob with a
 *  ground shadow that squashes underneath it, wearing a different outfit
 *  each time you land here.
 *
 *  Drawn on a canvas rather than loaded as an image, so there's no asset to
 *  fetch on the one page that's already having a bad day. The outfit is
 *  chosen inside the effect — never during render — so the server and the
 *  browser can't disagree about which one it is. */
export function PixelMascot() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const label = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const costume = randomCostume();
    drawMascot(ctx, costume);
    if (label.current) label.current.textContent = costume.name;
  }, []);

  return (
    <div className="oops-sprite" aria-hidden="true">
      <div className="oops-sprite-shadow" />
      <canvas
        ref={canvas}
        className="oops-sprite-img"
        width={SPRITE_W}
        height={SPRITE_H}
      />
      <div className="oops-costume" ref={label} />
    </div>
  );
}
