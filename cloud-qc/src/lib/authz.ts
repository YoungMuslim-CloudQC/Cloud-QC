import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewScope } from "@/lib/role-access";
import { EMPTY_SCOPE, type ViewScope } from "@/lib/role-scope";

/** Set while an admin is looking at the app through someone else's eyes. */
export const VIEW_AS_COOKIE = "cloudqc_view_as";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "MEMBER" | "ADMIN";
  status: "PENDING" | "APPROVED" | "REJECTED";
  theme: string;
};

/** Who the admin really is, while they're viewing as someone else. Present
 *  only during impersonation, and the reason every write is refused: the
 *  point is to *see* what a coordinator sees, never to act as them and
 *  leave their fingerprints on the data. */
export type Impersonation = {
  realId: string;
  realName: string;
  viewingName: string;
};

/** A session user plus what their coordinator-side seats let them see. */
export type ScopedUser = SessionUser & {
  scope: ViewScope;
  impersonating: Impersonation | null;
};

/** Returns the session user or `null`. Never redirects. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/** The session user with role/status re-read from the database. The session
 *  token only refreshes on sign-in, so an admin changing someone's role (or
 *  approving/rejecting them) would otherwise not take effect until they sign
 *  out — not acceptable for access that's meant to be restricted. */
async function getFreshUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true, status: true },
  });
  if (!row) return null;
  // Role.COORDINATOR is a deprecated leftover that nothing writes any more
  // (coordinator-side roles are UserRoleAssignment rows now). No account
  // carries it, but the enum value still exists in the database until the
  // follow-up migration removes it, so narrow it away here rather than let
  // it leak into SessionUser.
  const role = row.role === "COORDINATOR" ? "MEMBER" : row.role;
  return { ...user, role, status: row.status };
}

/**
 * Same, plus their resolved view scope — and, for an admin who has picked
 * someone to view as, the *target's* identity and scope instead of their
 * own. Everything downstream then behaves exactly as it would for that
 * person: same redirects, same nav, same neighbornets, same empty states.
 *
 * `impersonating` carries the admin's real identity so the banner can show
 * it and the write guards can refuse.
 */
async function getFreshScopedUser(): Promise<ScopedUser | null> {
  const real = await getFreshUser();
  if (!real) return null;

  if (real.role === "ADMIN") {
    const targetId = (await cookies()).get(VIEW_AS_COOKIE)?.value;
    if (targetId && targetId !== real.id) {
      const target = await db.user.findUnique({
        where: { id: targetId },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          status: true,
          theme: true,
        },
      });
      if (target) {
        return {
          id: target.id,
          name: target.name,
          email: target.email,
          image: target.image,
          role: target.role === "ADMIN" ? "ADMIN" : "MEMBER",
          status: target.status,
          // Keep the admin's own theme — swapping it mid-session is
          // disorienting and tells them nothing about what the other
          // person sees structurally.
          theme: real.theme,
          scope: await getViewScope(target.id),
          impersonating: {
            realId: real.id,
            realName: real.name ?? real.email ?? "Admin",
            viewingName: target.name ?? target.email ?? "that account",
          },
        };
      }
    }
  }

  return { ...real, scope: await getViewScope(real.id), impersonating: null };
}

/** The signed-in admin themselves, ignoring any view-as in effect. Used by
 *  the controls that start and stop impersonation — those must answer to
 *  the real account, not the borrowed one. */
export async function requireRealAdmin(): Promise<SessionUser> {
  const real = await getFreshUser();
  if (!real || real.status !== "APPROVED" || real.role !== "ADMIN") {
    throw new Error("Forbidden: admin only");
  }
  return real;
}

/** Signed-in, APPROVED user of any kind — QC member, admin, or someone
 *  holding a coordinator-side seat. Only for the screens all three share
 *  (layout, profile). Redirects otherwise. */
export async function requireApprovedAny(): Promise<ScopedUser> {
  const user = await getFreshScopedUser();
  if (!user) redirect("/login");
  if (user.status !== "APPROVED") redirect("/pending");
  return user;
}

/** Requires an APPROVED QC member or admin. Anyone holding a coordinator-side
 *  seat is view-only and gets sent to their own view — every member screen
 *  goes through this. */
export async function requireApproved(): Promise<ScopedUser> {
  const user = await requireApprovedAny();
  if (user.role !== "ADMIN" && user.scope.viewOnly) redirect("/coordinator");
  return user;
}

/** Requires an APPROVED admin. Redirects otherwise. */
export async function requireAdmin(): Promise<ScopedUser> {
  // An admin part-way through a view-as fails the checks below, because the
  // whole point is that they're carrying the other person's identity: the
  // role is theirs, the scope is theirs, and requireApproved sends them to
  // /coordinator like it would send that person. That's right for every
  // other screen and wrong here — it means clicking "Admin" silently lands
  // on someone else's dashboard, which reads as the admin pages being
  // broken rather than as view-as still being on. Say so instead.
  const current = await getFreshScopedUser();
  if (current?.impersonating) redirect("/admin/paused");

  const user = await requireApproved();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Requires someone holding at least one coordinator-side seat (or an admin,
 *  who can see every such view). Everyone else goes to their home. */
export async function requireViewRole(): Promise<ScopedUser> {
  const user = await requireApprovedAny();
  if (user.role !== "ADMIN" && !user.scope.viewOnly) redirect("/dashboard");
  return user;
}

/** Requires a Cloud Lead (or an admin). Note this goes through
 *  requireApproved, not requireApprovedAny: a lead is a QC member, so they
 *  belong on the member side of the app rather than the view-only side. */
export async function requireCloudLead(): Promise<ScopedUser> {
  const user = await requireApproved();
  if (user.role !== "ADMIN" && !user.scope.cloudLead) redirect("/dashboard");
  return user;
}

/** Requires someone who can see the national rollup: an SR coordinator, one
 *  of their core team, or an admin. */
export async function requireNationalRollup(): Promise<ScopedUser> {
  const user = await requireApprovedAny();
  if (user.role !== "ADMIN" && !user.scope.nationalRollup) redirect("/coordinator");
  return user;
}

/**
 * For use inside Server Actions: throws instead of redirecting so the action
 * fails loudly rather than returning a redirect response.
 */
export async function assertApprovedAny(): Promise<ScopedUser> {
  const user = await getFreshScopedUser();
  if (!user || user.status !== "APPROVED") {
    throw new Error("Unauthorized");
  }
  // Every server action funnels through here, so this one check makes the
  // whole of view-as read-only. Without it an admin looking at someone's
  // inbox could tick their visits off as read, or add people to their core
  // team, and the record would show that person doing it.
  if (user.impersonating) {
    throw new Error(
      "You're viewing as someone else — stop before making changes.",
    );
  }
  return user;
}

/** Member/admin actions — a view-only seat can't log or change QC data,
 *  even if the same person is also a MEMBER. */
export async function assertApproved(): Promise<ScopedUser> {
  const user = await assertApprovedAny();
  if (user.role !== "ADMIN" && user.scope.viewOnly) {
    throw new Error("Forbidden: this account is view-only");
  }
  return user;
}

export async function assertAdmin(): Promise<ScopedUser> {
  const user = await assertApprovedAny();
  if (user.role !== "ADMIN") {
    throw new Error("Forbidden: admin only");
  }
  return user;
}

/** Server-action counterpart to requireViewRole. */
export async function assertViewRole(): Promise<ScopedUser> {
  const user = await assertApprovedAny();
  if (user.role !== "ADMIN" && !user.scope.viewOnly) {
    throw new Error("Forbidden: no coordinator role");
  }
  return user;
}

export { EMPTY_SCOPE };
