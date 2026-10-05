import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import authConfig from "@/lib/auth.config";

// Edge-safe Auth.js instance (no Prisma adapter / Node APIs) — used only to
// read and verify the session JWT for route protection.
const { auth } = NextAuth(authConfig);

/** Auth pages: reachable signed out, redirected away from once signed in. */
const PUBLIC_PATHS = ["/login", "/signup"];

/**
 * Open to everyone, signed in or not, and never redirected away from.
 *
 * The SMS opt-in form and the policies it links to have to be reachable by
 * someone with no account at all — a carrier reviewing the A2P campaign
 * opens them cold, and a redirect to /login reads as the opt-in not
 * existing. They're also linked from text messages, which land on whatever
 * device the person is holding.
 */
const OPEN_PATHS = ["/sms-opt-in", "/terms", "/privacy"];

export default auth((req) => {
  const { nextUrl } = req;
  const session = req.auth;
  const path = nextUrl.pathname;

  // Cron routes carry their own CRON_SECRET check (Vercel Cron calls them
  // with no session cookie at all — a redirect-to-login here would silently
  // break every scheduled run).
  if (path.startsWith("/api/cron/")) return NextResponse.next();

  const matches = (list: string[]) =>
    list.some((p) => path === p || path.startsWith(`${p}/`));

  // Checked before anything else, including the signed-in redirects below —
  // an approved user following a STOP/HELP link from a text should land on
  // the policy, not be bounced to their dashboard.
  if (matches(OPEN_PATHS)) return NextResponse.next();

  const isPublic = matches(PUBLIC_PATHS);
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
