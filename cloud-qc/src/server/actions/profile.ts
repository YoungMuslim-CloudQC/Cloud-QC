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
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

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
  const wasConsenting = await db.user.findUnique({
    where: { id: me.id },
    select: { smsConsent: true },
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
        ? (wasConsenting?.smsConsent ? undefined : new Date())
        : null,
      ...(imageUrl ? { image: imageUrl } : {}),
    },
  });

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  revalidatePath("/team");
  return { ok: true };
}
