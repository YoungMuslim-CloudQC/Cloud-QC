import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: "MEMBER" | "ADMIN";
  status: "PENDING" | "APPROVED" | "REJECTED";
  theme: string;
};

/** Returns the session user or `null`. Never redirects. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  return (session?.user as SessionUser | undefined) ?? null;
}

/** Requires a signed-in, APPROVED user. Redirects otherwise. */
export async function requireApproved(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status !== "APPROVED") redirect("/pending");
  return user;
}

/** Requires an APPROVED admin. Redirects otherwise. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireApproved();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

/**
 * For use inside Server Actions: throws instead of redirecting so the action
 * fails loudly rather than returning a redirect response.
 */
export async function assertApproved(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user || user.status !== "APPROVED") {
    throw new Error("Unauthorized");
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
