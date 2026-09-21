import { z } from "zod";

// Keys must match the `[data-theme="..."]` blocks in globals.css. `bg`
// mirrors that block's --bg value — used for the PWA/mobile-browser
// theme-color meta tag (see generateViewport in app/layout.tsx) so it
// matches whichever palette is active instead of staying Nebula's.
export const THEMES = [
  { key: "default", label: "Nebula", blurb: "Violet & cyan — the original look", bg: "#0d0821" },
  { key: "paper", label: "Paper", blurb: "Plain white, easy on the eyes", bg: "#f5f5f8" },
  { key: "onyx", label: "Onyx", blurb: "Plain black & gray", bg: "#050505" },
  { key: "aurora", label: "Aurora", blurb: "Teal & emerald", bg: "#061615" },
  { key: "sepia", label: "Sepia", blurb: "Tan & brown, warm and soft", bg: "#2b2219" },
  { key: "nocturne", label: "Nocturne", blurb: "Blue & violet", bg: "#060a18" },
  { key: "crimson", label: "Crimson", blurb: "Red & orange", bg: "#170808" },
  { key: "citrus", label: "Citrus", blurb: "Lime & yellow", bg: "#0f1408" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];
const THEME_KEYS = THEMES.map((t) => t.key) as [ThemeKey, ...ThemeKey[]];

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

/**
 * Self-service profile fields. SMS/BOTH channels require both a phone number
 * and explicit consent — enforced here, not just disabled in the UI, since
 * this is a compliance-relevant checkbox (no SMS is actually sent yet, but
 * the consent record needs to be trustworthy once it is).
 */
export const profileSchema = z
  .object({
    phone: z.preprocess(
      emptyToUndef,
      z
        .string()
        .trim()
        .regex(/^[0-9+()\-.\s]{7,20}$/, "Enter a valid phone number")
        .optional(),
    ),
    theme: z.enum(THEME_KEYS).default("default"),
    digestCadence: z.enum(["OFF", "WEEKLY", "BIWEEKLY", "MONTHLY"]).default("OFF"),
    notificationChannel: z.enum(["EMAIL", "SMS", "BOTH"]).default("EMAIL"),
    smsConsent: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
    // Validated against the live region map (not statically known here) in
    // the action itself — this just checks shape.
    homeRegion: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
    homeSubArea: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
    digestSubAreas: z.array(z.string().trim().max(80)).default([]),
    // Validated against real neighbornet ids (not statically known here) in
    // the action itself.
    representingNeighbornetId: z.preprocess(emptyToUndef, z.string().trim().optional()),
  })
  .refine((d) => d.notificationChannel === "EMAIL" || Boolean(d.phone), {
    message: "Add a phone number to receive SMS notifications.",
    path: ["phone"],
  })
  .refine((d) => d.notificationChannel === "EMAIL" || d.smsConsent, {
    message: "Check the consent box to receive text messages.",
    path: ["smsConsent"],
  })
  .refine((d) => Boolean(d.homeRegion) === Boolean(d.homeSubArea), {
    message: "Pick both a region and an area, or leave both blank.",
    path: ["homeSubArea"],
  });

export type ProfileInput = z.infer<typeof profileSchema>;

/**
 * Admin-on-behalf-of-another-user editing. Deliberately narrower than
 * `profileSchema` — name/phone/photo are administrative "fix a typo" /
 * "add their photo" fields. Personal preferences (theme, digest cadence,
 * notification channel, and especially SMS consent) stay self-service only;
 * consent in particular has to come from the person it belongs to.
 */
export const adminProfileSchema = z.object({
  userId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120),
  phone: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .regex(/^[0-9+()\-.\s]{7,20}$/, "Enter a valid phone number")
      .optional(),
  ),
});

export type AdminProfileInput = z.infer<typeof adminProfileSchema>;

// Shared by both the self-service and admin-on-behalf-of profile actions.
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
