"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertViewRole } from "@/lib/authz";
import { db } from "@/lib/db";
import { canSeeFullDetail } from "@/lib/role-scope";

/** Confirms the caller is actually allowed to see this visit before letting
 *  them act on it — a visit is in scope if any neighbornet it counts toward
 *  is one they can see in full detail. */
async function assertCanSeeVisit(visitId: string) {
  const me = await assertViewRole();
  const visit = await db.visit.findUnique({
    where: { id: visitId },
    select: {
      deletedAt: true,
      neighbornets: {
        select: { neighbornet: { select: { id: true, subArea: true } } },
      },
    },
  });
  if (!visit || visit.deletedAt) throw new Error("That visit no longer exists.");

  const allowed =
    me.role === "ADMIN" ||
    visit.neighbornets.some((l) => canSeeFullDetail(me.scope, l.neighbornet));
  if (!allowed) throw new Error("Forbidden: that visit isn't yours to review.");

  return me;
}

/** Tick a visit off your own list. Per person — marking it read never
 *  clears it for the rest of the team. */
export async function markVisitReviewed(visitId: string) {
  const me = await assertCanSeeVisit(z.string().min(1).parse(visitId));
  await db.coordinatorVisitReview.upsert({
    where: { userId_visitId: { userId: me.id, visitId } },
    update: {},
    create: { userId: me.id, visitId },
  });
  revalidatePath("/coordinator");
  revalidatePath("/coordinator/inbox");
  return { ok: true as const };
}

export async function markVisitUnreviewed(visitId: string) {
  const me = await assertCanSeeVisit(z.string().min(1).parse(visitId));
  await db.coordinatorVisitReview.deleteMany({
    where: { userId: me.id, visitId },
  });
  revalidatePath("/coordinator");
  revalidatePath("/coordinator/inbox");
  return { ok: true as const };
}

/** Clear everything currently in view in one go. */
export async function markAllReviewed(visitIds: string[]) {
  const me = await assertViewRole();
  const ids = z.array(z.string().min(1)).max(200).parse(visitIds);
  if (ids.length === 0) return { ok: true as const };

  // Re-check scope over the whole set rather than trusting the ids posted.
  const visits = await db.visit.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: {
      id: true,
      neighbornets: { select: { neighbornet: { select: { id: true, subArea: true } } } },
    },
  });
  const allowed = visits
    .filter(
      (v) =>
        me.role === "ADMIN" ||
        v.neighbornets.some((l) => canSeeFullDetail(me.scope, l.neighbornet)),
    )
    .map((v) => v.id);

  await db.coordinatorVisitReview.createMany({
    data: allowed.map((visitId) => ({ userId: me.id, visitId })),
    skipDuplicates: true,
  });
  revalidatePath("/coordinator");
  revalidatePath("/coordinator/inbox");
  return { ok: true as const };
}

export type CoreTeamState = { ok?: boolean; error?: string; notice?: string };

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  name: z.string().trim().max(120).optional(),
});

/**
 * Put someone on your core team. Two paths, both landing in the same place:
 * an existing approved member is seated straight away, and an unknown email
 * creates a PENDING account for the admin queue. Either way the seat is a
 * CORE_TEAM assignment inheriting from you, so they see exactly what you
 * see and nothing more.
 */
export async function inviteCoreTeamMember(
  _prev: CoreTeamState,
  formData: FormData,
): Promise<CoreTeamState> {
  const me = await assertViewRole();
  if (me.role === "ADMIN" && !me.scope.viewOnly) {
    return { ok: false, error: "Admins manage core teams from the admin page." };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { email, name } = parsed.data;

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true, name: true },
  });

  if (existing?.id === me.id) {
    return { ok: false, error: "That's you." };
  }

  if (existing) {
    const already = await db.userRoleAssignment.findFirst({
      where: { userId: existing.id, roleType: "CORE_TEAM", inheritsFromUserId: me.id },
      select: { id: true },
    });
    if (already) {
      return { ok: false, error: "They're already on your core team." };
    }
    await db.userRoleAssignment.create({
      data: {
        userId: existing.id,
        roleType: "CORE_TEAM",
        inheritsFromUserId: me.id,
        grantedById: me.id,
      },
    });
    revalidatePath("/coordinator/team");
    return {
      ok: true,
      notice:
        existing.status === "APPROVED"
          ? `${existing.name ?? email} is on your core team.`
          : `${existing.name ?? email} is on your core team — their account is still waiting on admin approval.`,
    };
  }

  // Nobody with that email yet: create the PENDING account and seat them.
  // The admin queue shows who invited them when they come up for approval.
  await db.user.create({
    data: {
      email,
      name: name || null,
      status: "PENDING",
      role: "MEMBER",
      roleAssignments: {
        create: {
          roleType: "CORE_TEAM",
          inheritsFromUserId: me.id,
          grantedById: me.id,
        },
      },
    },
  });
  revalidatePath("/coordinator/team");
  revalidatePath("/admin");
  return {
    ok: true,
    notice: `Invited ${email}. They'll need to sign up with that address, and an admin approves them before they can see anything.`,
  };
}

/** Take someone off your core team. Only removes the seat *you* granted —
 *  never touches their account or any other role they hold. */
export async function removeCoreTeamMember(userId: string) {
  const me = await assertViewRole();
  await db.userRoleAssignment.deleteMany({
    where: {
      userId: z.string().min(1).parse(userId),
      roleType: "CORE_TEAM",
      inheritsFromUserId: me.id,
    },
  });
  revalidatePath("/coordinator/team");
  return { ok: true as const };
}
