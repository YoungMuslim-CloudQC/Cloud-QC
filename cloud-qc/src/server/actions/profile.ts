"use server";

import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

import { assertApproved } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  profileSchema,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_TYPES,
} from "@/lib/profile-schema";
import { buildDigestContent, digestEmailHtml } from "@/lib/digest";
import { sendDigestEmail } from "@/lib/resend";
import { memberName, getRegionMap } from "@/lib/queries";

const DIGEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type ProfileState = { ok?: boolean; error?: string };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const me = await assertApproved();

  const parsed = profileSchema.safeParse({
    phone: formData.get("phone"),
    theme: formData.get("theme"),
    digestCadence: formData.get("digestCadence"),
    notificationChannel: formData.get("notificationChannel"),
    smsConsent: formData.get("smsConsent"),
    homeRegion: formData.get("homeRegion"),
    homeSubArea: formData.get("homeSubArea"),
    digestSubAreas: formData.getAll("digestSubAreas"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

  // homeRegion/homeSubArea and every digestSubAreas entry must be real,
  // current subAreas — the zod schema above only checked shape, not that
  // these actually exist (that needs a DB round-trip).
  const regionMap = await getRegionMap();
  const allSubAreas = new Set(regionMap.flatMap((r) => r.subAreas));
  if (d.homeSubArea && !allSubAreas.has(d.homeSubArea)) {
    return { ok: false, error: "Pick a valid area from the list." };
  }
  const invalidPick = d.digestSubAreas.find((a) => !allSubAreas.has(a));
  if (invalidPick) {
    return { ok: false, error: "Pick valid areas from the list." };
  }

  // Photo is optional and only present when the user picked a new file.
  const photo = formData.get("photo");
  let imageUrl: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    if (!ALLOWED_PHOTO_TYPES.includes(photo.type)) {
      return { ok: false, error: "Photo must be JPG, PNG, or WEBP." };
    }
    if (photo.size > MAX_PHOTO_BYTES) {
      return { ok: false, error: "Photo must be under 5MB." };
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return {
        ok: false,
        error: "Photo uploads aren't configured yet — ask an admin to set up Vercel Blob.",
      };
    }
    const blob = await put(`profile-photos/${me.id}-${Date.now()}`, photo, {
      access: "public",
      contentType: photo.type,
    });
    imageUrl = blob.url;
  }

  // smsConsentAt tracks the moment consent was *given*; unchecking the box
  // clears it, and re-checking later stamps it fresh — never backdated.
  // Also need the *before* state to know whether the cadence actually
  // changed (for the immediate-digest-on-opt-in below).
  const before = await db.user.findUniqueOrThrow({
    where: { id: me.id },
    select: {
      smsConsent: true,
      digestCadence: true,
      lastDigestSentAt: true,
      name: true,
      email: true,
    },
  });

  await db.user.update({
    where: { id: me.id },
    data: {
      phone: d.phone ?? null,
      theme: d.theme,
      digestCadence: d.digestCadence,
      notificationChannel: d.notificationChannel,
      smsConsent: d.smsConsent,
      smsConsentAt: d.smsConsent
        ? (before.smsConsent ? undefined : new Date())
        : null,
      homeRegion: d.homeRegion ?? null,
      homeSubArea: d.homeSubArea ?? null,
      digestSubAreas: d.digestSubAreas,
      ...(imageUrl ? { image: imageUrl } : {}),
    },
  });

  // Selecting a cadence (turning it on, or picking a different one) sends
  // an immediate digest right then, rather than making them wait for the
  // next scheduled run — unless one already went out in the last 24h, to
  // stop someone toggling the radio a few times from spamming themselves.
  const cadenceChanged = d.digestCadence !== before.digestCadence;
  const withinCooldown =
    before.lastDigestSentAt &&
    Date.now() - before.lastDigestSentAt.getTime() < DIGEST_COOLDOWN_MS;
  if (cadenceChanged && d.digestCadence !== "OFF" && !withinCooldown) {
    try {
      const content = await buildDigestContent(me.id, d.digestCadence, before.lastDigestSentAt);
      const { subject, html } = digestEmailHtml(content, {
        firstName: memberName(before).split(" ")[0] ?? "there",
        appUrl: process.env.APP_URL ?? "http://localhost:3000",
      });
      const sent = await sendDigestEmail({ to: before.email, subject, html });
      // Best-effort: the profile save already succeeded regardless of
      // whether this welcome digest goes out.
      if (sent.ok) {
        await db.user.update({
          where: { id: me.id },
          data: { lastDigestSentAt: new Date() },
        });
      }
    } catch {
      // swallow — see above
    }
  }

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  revalidatePath("/team");
  return { ok: true };
}
