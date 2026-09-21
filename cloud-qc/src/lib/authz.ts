import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "MEMBER" | "ADMIN" | "COORDINATOR";
  status: "PENDING" | "APPROVED" | "REJECTED";
  theme: string;
};

/** Returns the session user or `null`. Never redirects. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/** The session user with role/status re-read from the database. The session
 *  token only refreshes on sign-in, so an admin changing someone's role (or
 *  approving/rejecting them) would otherwise not take effect until they sign
 *  out — not acceptable for a role that's meant to be restricted. */
async function getFreshUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true, status: true },
  });
  if (!row) return null;
  return { ...user, role: row.role, status: row.status };
}

/** Signed-in, APPROVED user of any role. Only for the few screens that are
 *  shared with coordinators (layout, profile). Redirects otherwise. */
export async function requireApprovedAny(): Promise<SessionUser> {
  const user = await getFreshUser();
  if (!user) redirect("/login");
  if (user.status !== "APPROVED") redirect("/pending");
  return user;
}

/** Requires a signed-in, APPROVED QC member or admin. Coordinators are sent
 *  to their own inbox — every member screen goes through this. */
export async function requireApproved(): Promise<SessionUser> {
  const user = await requireApprovedAny();
  if (user.role === "COORDINATOR") redirect("/coordinator");
  return user;
}

/** Requires an APPROVED admin. Redirects otherwise. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireApproved();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/** Requires an APPROVED coordinator. Everyone else goes to their home. */
export async function requireCoordinator(): Promise<SessionUser> {
  const user = await requireApprovedAny();
  if (user.role !== "COORDINATOR") redirect("/dashboard");
  return user;
}

/**
 * For use inside Server Actions: throws instead of redirecting so the action
 * fails loudly rather than returning a redirect response.
 */
export async function assertApprovedAny(): Promise<SessionUser> {
  const user = await getFreshUser();
  if (!user || user.status !== "APPROVED") {
    throw new Error("Unauthorized");
  }
  return user;
}

/** Member/admin actions — coordinators can't log or change QC data. */
export async function assertApproved(): Promise<SessionUser> {
  const user = await assertApprovedAny();
  if (user.role === "COORDINATOR") {
    throw new Error("Forbidden: coordinators can't do this");
  }
  return user;
}

export async function assertAdmin(): Promise<SessionUser> {
  const user = await assertApproved();
  if (user.role !== "ADMIN") {
    throw new Error("Forbidden: admin only");
  }
  return user;
}
