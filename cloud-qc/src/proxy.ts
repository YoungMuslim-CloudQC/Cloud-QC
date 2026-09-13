import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/lib/auth.config";

// Edge-safe Auth.js instance (no Prisma adapter / Node APIs) — used only to
// read and verify the session JWT for route protection.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login", "/signup"];

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const path = nextUrl.pathname;

  // Cron routes carry their own CRON_SECRET check (Vercel Cron calls them
  // with no session cookie at all — a redirect-to-login here would silently
  // break every scheduled run).
  if (path.startsWith("/api/cron/")) return NextResponse.next();

  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(`${p}/`),
  );
  const isPending = path === "/pending";

  // Not signed in
  if (!session?.user) {
    if (isPublic) return NextResponse.next();
    const url = new URL("/login", nextUrl);
    if (path !== "/") url.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(url);
  }

  const approved = session.user.status === "APPROVED";

  // Signed in but not approved → only the /pending page is reachable
  if (!approved) {
    if (isPending) return NextResponse.next();
    return NextResponse.redirect(new URL("/pending", nextUrl));
  }

  // Approved users have no business on auth pages
  if (isPublic || isPending) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals, the auth API, and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
