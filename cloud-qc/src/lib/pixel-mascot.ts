/**
 * The pixel mascot on the error pages, drawn in code rather than loaded as
 * an image — no asset to ship, and it can wear a different outfit on every
 * visit.
 *
 * Deliberately coarse, in the style of classic character sprite sheets: 18
 * by 28, flat colours only, single-pixel dot eyes, no shading anywhere. The
 * beard sits below the mouth so the face stays open rather than becoming a
 * dark mask.
 */

/** One character per pixel; "." is transparent. */
const BODY = [
  "....hhhhhhhhhh....",
  "...hhhhhhhhhhhh...",
  "...hhhhhhhhhhhh...",
  "..phhhhhhhhhhhhp..",
  "..pssssssssssssp..",
  "..psssessssesssp..",
  "..pssssssssssssp..",
  "..pssssssssssssp..",
  "...sssbbbbbbsss...",
  "...sssbbttbbsss...",
  "....ssbbbbbbss....",
  ".......ssss.......",
  "...rrrrrrrrrrrr...",
  "..rrrrrrrrrrrrrr..",
  "..rrrrrrrrrrrrrr..",
  "..rrrrrrrrrrrrrr..",
  "..rrrrrrrrrrrrrr..",
  "..srrrrrrrrrrrrs..",
  "...rrrrrrrrrrrr...",
  "...rrrrrrrrrrrr...",
  "...LLLLLLLLLLLL...",
  "...nnnnnnnnnnnn...",
  "...nnnnn..nnnnn...",
  "...nnnnn..nnnnn...",
  "...nnnnn..nnnnn...",
  "...nnnnn..nnnnn...",
  "...ooooo..ooooo...",
  "..oooooo..oooooo..",
];

export const SPRITE_W = 18;
export const SPRITE_H = 28;

/** Shared across every outfit — this is him, not the costume. */
const BASE_COLORS: Record<string, string> = {
  h: "#1b1b1f", // hair
  p: "#5a5a66", // headphones
  s: "#f2bc8d", // skin
  e: "#1b1b1f", // eye
  b: "#43301f", // beard
  t: "#ef6d82", // tongue
};

export type Costume = {
  name: string;
  /** Overrides for the clothing glyphs: r shirt, L belt, n legs, o shoes. */
  colors: Record<string, string>;
  /** Optional headwear painted over the top rows. A/B/C are its colours. */
  hat?: { art: string[]; colors: Record<string, string> };
  /** Swaps the headphones out (a helmet covers them). */
  hidePhones?: boolean;
};

const CAP = (crown: string, band: string, brim: string) => ({
  art: [
    "....AAAAAAAAAA....",
    "...AAAAAAAAAAAA...",
    "...ABBBBBBBBBBA...",
    "..CCCCCCCCCCCCCC..",
  ],
  colors: { A: crown, B: band, C: brim },
});

export const COSTUMES: Costume[] = [
  {
    name: "Off duty",
    colors: { r: "#dc2f3f", L: "#1b1b1f", n: "#2f2f3a", o: "#1b1b1f" },
  },
  {
    name: "Police",
    colors: { r: "#2f3f63", L: "#12121a", n: "#232c44", o: "#12121a" },
    hat: CAP("#2f3f63", "#f2c14e", "#12121a"),
  },
  {
    name: "Firefighter",
    colors: { r: "#2b2b33", L: "#f2c14e", n: "#2b2b33", o: "#12121a" },
    hat: CAP("#c8352c", "#f2c14e", "#8f2119"),
  },
  {
    name: "Surgeon",
    colors: { r: "#4fb3a5", L: "#3d8f85", n: "#4fb3a5", o: "#e8e8ea" },
    hat: {
      art: [
        "....AAAAAAAAAA....",
        "...AAAAAAAAAAAA...",
        "...AAAAAAAAAAAA...",
        "..................",
      ],
      colors: { A: "#4fb3a5" },
    },
  },
  {
    name: "Builder",
    colors: { r: "#f08a24", L: "#2b2b33", n: "#3b5482", o: "#5c4326" },
    hat: CAP("#f2c14e", "#e0a52e", "#e0a52e"),
  },
  {
    name: "Chef",
    colors: { r: "#f0f0f2", L: "#d8d8dc", n: "#2f2f3a", o: "#1b1b1f" },
    hat: {
      art: [
        "...AAAAAAAAAAAA...",
        "...AAAAAAAAAAAA...",
        "....AAAAAAAAAA....",
        "...BBBBBBBBBBBB...",
      ],
      colors: { A: "#f7f7f9", B: "#e2e2e6" },
    },
  },
  {
    name: "Astronaut",
    colors: { r: "#e8e8ec", L: "#a8a8b4", n: "#e8e8ec", o: "#a8a8b4" },
    hidePhones: true,
    hat: {
      art: [
        "...AAAAAAAAAAAA...",
        "..AAAAAAAAAAAAAA..",
        "..AABBBBBBBBBBAA..",
        "..AABBBBBBBBBBAA..",
      ],
      colors: { A: "#d8d8e0", B: "#2b3a52" },
    },
  },
  {
    name: "Wizard",
    colors: { r: "#6d4bb5", L: "#f2c14e", n: "#4a3280", o: "#3a2763" },
    hat: {
      art: [
        ".......AAA........",
        "......AAAAA.......",
        ".....AAAAAAA......",
        "...BBBBBBBBBBBB...",
      ],
      colors: { A: "#4a3280", B: "#6d4bb5" },
    },
  },
  {
    name: "Footballer",
    colors: { r: "#2f9e5c", L: "#f0f0f2", n: "#f0f0f2", o: "#1b1b1f" },
  },
  {
    name: "Businessman",
    colors: { r: "#26262e", L: "#12121a", n: "#26262e", o: "#12121a" },
  },
];

/** Pick one at random. Call this on the client only — choosing during
 *  render on the server would hand the browser a different outfit than the
 *  HTML it just received. */
export function randomCostume(): Costume {
  return COSTUMES[Math.floor(Math.random() * COSTUMES.length)];
}

/** Paint the mascot onto a 18x28 canvas context, one fillRect per pixel. */
export function drawMascot(ctx: CanvasRenderingContext2D, costume: Costume) {
  ctx.clearRect(0, 0, SPRITE_W, SPRITE_H);

  const palette: Record<string, string> = { ...BASE_COLORS, ...costume.colors };
  if (costume.hidePhones) delete palette.p;

  BODY.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const colour = palette[ch];
      if (colour) {
        ctx.fillStyle = colour;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  });

  // Headwear last, so it sits over the hair.
  if (costume.hat) {
    costume.hat.art.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const colour = costume.hat!.colors[ch];
        if (colour) {
          ctx.fillStyle = colour;
          ctx.fillRect(x, y, 1, 1);
        }
      });
    });
  }
}
