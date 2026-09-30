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
  const role = z.enum(["MEMBER", "ADMIN"]).parse(formData.get("role"));

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

/** Make someone the coordinator of one neighbornet, replacing whichever
 *  neighbornet they currently coordinate. A person holds at most one
 *  COORDINATOR seat — a *neighbornet* can have two holders, but only through
 *  the succession flow, never by an admin assigning a second person here. */
export async function setCoordinatorNeighbornet(
  userId: string,
  neighbornetId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const me = await assertAdmin();
  const id = neighbornetId
    ? z.string().min(1).parse(neighbornetId)
    : null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "That account no longer exists." };

  if (id) {
    const found = await db.neighbornet.count({
      where: { id, archivedAt: null },
    });
    if (found !== 1) {
      return { ok: false, error: "That neighbornet isn't available." };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.userRoleAssignment.deleteMany({
      where: { userId, roleType: "COORDINATOR" },
    });
    if (id) {
      await tx.userRoleAssignment.create({
        data: {
          userId,
          roleType: "COORDINATOR",
          scopeNeighbornetId: id,
          grantedById: me.id,
        },
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/coordinator");
  return { ok: true };
}

/** Make someone a Cloud Lead, or take it away. Unlike the coordinator-side
 *  seats this grants rather than restricts: a lead keeps every QC ability
 *  and gains a view of the whole team, so it's safe to hand to a working
 *  member without cutting off their own work. */
export async function setCloudLead(
  userId: string,
  isLead: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const me = await assertAdmin();
  const id = z.string().min(1).parse(userId);

  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return { ok: false, error: "That account no longer exists." };

  if (isLead) {
    const already = await db.userRoleAssignment.findFirst({
      where: { userId: id, roleType: "CLOUD_LEAD" },
      select: { id: true },
    });
    if (!already) {
      await db.userRoleAssignment.create({
        data: { userId: id, roleType: "CLOUD_LEAD", grantedById: me.id },
      });
    }
  } else {
    await db.userRoleAssignment.deleteMany({
      where: { userId: id, roleType: "CLOUD_LEAD" },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/lead");
  return { ok: true };
}

/** Make someone the SR coordinator of one sub-region (or clear it).
 *  Admin-assigned only — never self-requestable at signup. */
export async function setSrCoordinatorSubregion(
  userId: string,
  subregion: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const me = await assertAdmin();
  const sub = subregion ? z.string().trim().min(1).max(80).parse(subregion) : null;

  if (sub) {
    const exists = await db.neighbornet.count({
      where: { subArea: sub, archivedAt: null },
    });
    if (exists === 0) {
      return { ok: false, error: "No neighbornets are in that sub-region." };
    }
  }

  await db.$transaction(async (tx) => {
    await tx.userRoleAssignment.deleteMany({
      where: { userId, roleType: "SR_COORDINATOR" },
    });
    if (sub) {
      await tx.userRoleAssignment.create({
        data: {
          userId,
          roleType: "SR_COORDINATOR",
          scopeSubregion: sub,
          grantedById: me.id,
        },
      });
    }
  });

  revalidatePath("/admin");
  revalidatePath("/coordinator");
  return { ok: true };
}
