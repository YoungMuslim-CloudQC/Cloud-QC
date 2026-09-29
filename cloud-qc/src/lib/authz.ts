import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getViewScope } from "@/lib/role-access";
import { EMPTY_SCOPE, type ViewScope } from "@/lib/role-scope";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "MEMBER" | "ADMIN";
  status: "PENDING" | "APPROVED" | "REJECTED";
  theme: string;
};

/** A session user plus what their coordinator-side seats let them see. */
export type ScopedUser = SessionUser & { scope: ViewScope };

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

/** Same, plus their resolved view scope. */
async function getFreshScopedUser(): Promise<ScopedUser | null> {
  const user = await getFreshUser();
  if (!user) return null;
  const scope = await getViewScope(user.id);
  return { ...user, scope };
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
