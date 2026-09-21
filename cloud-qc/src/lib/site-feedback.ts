/** Server actions cap request bodies at ~1MB by default; the widget shrinks
 *  its screenshot to fit under this, and the action rejects anything larger. */
export const MAX_SCREENSHOT_CHARS = 700_000;

/** What the widget records about where on the page the comment applies. */
export type SiteFeedbackContext = {
  selector?: string;
  text?: string;
  rect?: { x: number; y: number; w: number; h: number };
  viewport: { w: number; h: number };
  scrollY?: number;
  userAgent?: string;
  theme?: string;
};
