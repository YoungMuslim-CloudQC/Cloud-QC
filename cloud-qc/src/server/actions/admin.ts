"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { put } from "@vercel/blob";

import { assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import {
  adminProfileSchema,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_TYPES,
} from "@/lib/profile-schema";

const idSchema = z.object({ userId: z.string().min(1) });

export async function approveUser(formData: FormData) {
  await assertAdmin();
  const { userId } = idSchema.parse({ userId: formData.get("userId") });
  await db.user.update({
    where: { id: userId },
    data: { status: "APPROVED" },
  });
  revalidatePath("/admin");
  revalidatePath("/team");
}

export async function rejectUser(formData: FormData) {
  await assertAdmin();
  const { userId } = idSchema.parse({ userId: formData.get("userId") });
  await db.user.update({
    where: { id: userId },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin");
  revalidatePath("/team");
}

export async function setUserRole(formData: FormData) {
  const me = await assertAdmin();
  const { userId } = idSchema.parse({ userId: formData.get("userId") });
  const role = z.enum(["MEMBER", "ADMIN", "COORDINATOR"]).parse(formData.get("role"));

  if (userId === me.id && role !== "ADMIN") {
    throw new Error("You can't remove your own admin access.");
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin");
}

export type AdminProfileState = { ok?: boolean; error?: string };

/** Admin edits another user's name/phone/photo. Deliberately does not touch
 *  theme, digest cadence, notification channel, or SMS consent — those are
 *  personal preferences (consent especially) that must come from the user
 *  themselves, not be set on their behalf. */
export async function adminUpdateMemberProfile(
  _prev: AdminProfileState,
  formData: FormData,
): Promise<AdminProfileState> {
  await assertAdmin();

  const parsed = adminProfileSchema.safeParse({
    userId: formData.get("userId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const d = parsed.data;

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
        error: "Photo uploads aren't configured yet — set up Vercel Blob first.",
      };
    }
    const blob = await put(`profile-photos/${d.userId}-${Date.now()}`, photo, {
      access: "public",
      contentType: photo.type,
    });
    imageUrl = blob.url;
  }

  await db.user.update({
    where: { id: d.userId },
    data: {
      name: d.name,
      phone: d.phone ?? null,
      ...(imageUrl ? { image: imageUrl } : {}),
    },
  });

  revalidatePath(`/team/${d.userId}`);
  revalidatePath("/team");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Replace the set of neighbornets a coordinator runs (their inbox is
 *  exactly this set). */
export async function setCoordinatorNeighbornets(
  userId: string,
  neighbornetIds: string[],
): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin();
  const ids = [...new Set(z.array(z.string().min(1)).max(50).parse(neighbornetIds))];

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "COORDINATOR") {
    return { ok: false, error: "That account isn't a coordinator." };
  }
  const found = await db.neighbornet.count({
    where: { id: { in: ids }, archivedAt: null },
  });
  if (found !== ids.length) {
    return { ok: false, error: "One of those neighbornets isn't available." };
  }

  await db.$transaction([
    db.neighbornetCoordinator.deleteMany({
      where: { userId, neighbornetId: { notIn: ids } },
    }),
    db.neighbornetCoordinator.createMany({
      data: ids.map((neighbornetId) => ({ userId, neighbornetId })),
      skipDuplicates: true,
    }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/coordinator");
  return { ok: true };
}
