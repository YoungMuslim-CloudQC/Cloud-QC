"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

/** Thin client boundary so client components (the theme picker) can call
 *  useSession().update() and get a live session without a full reload. */
export function AuthSessionProvider({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
