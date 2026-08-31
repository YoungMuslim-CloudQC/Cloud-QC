"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertAdmin } from "@/lib/authz";
import { db } from "@/lib/db";

const emptyToUndef = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  city: z.preprocess(emptyToUndef, z.string().trim().max(120).optional()),
  region: z.string().trim().min(1, "Region is required").max(80),
  subArea: z.string().trim().min(1, "Sub-area is required").max(80),
  stateCode: z.preprocess(
    emptyToUndef,
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, "Use the 2-letter code")
      .optional(),
  ),
  latitude: z.preprocess(
    emptyToUndef,
    z.coerce.number().min(-90).max(90).optional(),
  ),
  longitude: z.preprocess(
    emptyToUndef,
    z.coerce.number().min(-180).max(180).optional(),
  ),
  contactEmail: z.preprocess(
    emptyToUndef,
    z.string().trim().email("Not a valid email").optional(),
  ),
  instagram: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
});

export type AddNeighbornetState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function addNeighbornet(
  _prev: AddNeighbornetState,
  formData: FormData,
): Promise<AddNeighbornetState> {
  const admin = await assertAdmin();

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }

  const d = parsed.data;
  const created = await db.neighbornet.create({
    data: {
      name: d.name,
      city: d.city ?? null,
      region: d.region,
      subArea: d.subArea,
      stateCode: d.stateCode ?? null,
      latitude: d.latitude ?? null,
      longitude: d.longitude ?? null,
      contactEmail: d.contactEmail ?? null,
      instagram: d.instagram ?? null,
      createdById: admin.id,
    },
  });

  revalidatePath("/neighbornets", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/map");
  redirect(`/neighbornets/${created.id}`);
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
