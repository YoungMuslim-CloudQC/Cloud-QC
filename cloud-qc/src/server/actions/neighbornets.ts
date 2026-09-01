"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";
import { neighbornetSchema as schema } from "@/lib/neighbornet-schema";

export type NeighbornetFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function collectFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

export async function addNeighbornet(
  _prev: NeighbornetFormState,
  formData: FormData,
): Promise<NeighbornetFormState> {
  const admin = await assertAdmin();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const d = parsed.data;
  const created = await db.neighbornet.create({
    data: {
      name: d.name,
      city: d.city ?? null,
      region: d.region,
      subArea: d.subArea ?? null,
      stateCode: d.stateCode,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      contactEmail: d.contactEmail ?? null,
      instagram: d.instagram ?? null,
      createdById: admin.id,
    },
  });

  revalidateNeighbornetViews();
  redirect(`/neighbornets/${created.id}`);
}

export async function updateNeighbornet(
  id: string,
  _prev: NeighbornetFormState,
  formData: FormData,
): Promise<NeighbornetFormState> {
  await assertAdmin();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: collectFieldErrors(parsed.error.issues),
    };
  }

  const existing = await db.neighbornet.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "That neighbornet no longer exists." };

  const d = parsed.data;
  await db.neighbornet.update({
    where: { id },
    data: {
      name: d.name,
      city: d.city ?? null,
      region: d.region,
      subArea: d.subArea ?? null,
      stateCode: d.stateCode,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      contactEmail: d.contactEmail ?? null,
      instagram: d.instagram ?? null,
    },
  });

  revalidateNeighbornetViews();
  revalidatePath(`/neighbornets/${id}`);
  redirect(`/neighbornets/${id}`);
}

function revalidateNeighbornetViews() {
  revalidatePath("/neighbornets", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/map");
  revalidatePath("/rotation");
  revalidatePath("/feedback");
  revalidatePath("/admin/archived-neighbornets");
}

export async function archiveNeighbornet(formData: FormData) {
  const admin = await assertAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await db.neighbornet.update({
    where: { id },
    data: { archivedAt: new Date(), archivedById: admin.id },
  });
  revalidateNeighbornetViews();
  revalidatePath(`/neighbornets/${id}`);
}

export async function unarchiveNeighbornet(formData: FormData) {
  await assertAdmin();
  const id = z.string().min(1).parse(formData.get("id"));
  await db.neighbornet.update({
    where: { id },
    data: { archivedAt: null, archivedById: null },
  });
  revalidateNeighbornetViews();
  revalidatePath(`/neighbornets/${id}`);
}
