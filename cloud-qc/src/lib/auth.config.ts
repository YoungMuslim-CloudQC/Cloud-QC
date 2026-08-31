import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js config. No database or Node-only imports here — this is
 * also loaded by `proxy.ts`, which runs in the edge runtime.
 * The Credentials provider and Prisma adapter are added in `auth.ts`.
 */

const providers: NextAuthConfig["providers"] = [];

export const googleEnabled = Boolean(
  process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
);

/** If set, Google sign-in is restricted to this Google Workspace domain. */
export const googleHostedDomain =
  process.env.GOOGLE_HOSTED_DOMAIN?.toLowerCase().trim() || undefined;

if (googleEnabled) {
  providers.push(
    Google({
      // Same email via Google or password links to one account. Safe here
      // because Google verifies email ownership.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // UX hint — Google only offers accounts on this domain. Not a
          // security boundary; the real check is in the signIn callback.
          ...(googleHostedDomain ? { hd: googleHostedDomain } : {}),
          prompt: "select_account",
        },
      },
    }),
  );
}

type GoogleProfile = {
  email?: string;
  email_verified?: boolean;
  hd?: string;
};

export default {
  providers,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    signIn({ account, profile }) {
      // Enforce the Workspace-domain restriction for Google sign-in.
      if (account?.provider === "google" && googleHostedDomain) {
        const p = profile as GoogleProfile | undefined;
        const email = p?.email?.toLowerCase() ?? "";
        const domainOk =
          p?.hd?.toLowerCase() === googleHostedDomain &&
          email.endsWith(`@${googleHostedDomain}`);
        if (!p?.email_verified || !domainOk) return false;
      }
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = ((user as { role?: string }).role ?? "MEMBER") as
          | "MEMBER"
          | "ADMIN";
        token.status = ((user as { status?: string }).status ?? "PENDING") as
          | "PENDING"
          | "APPROVED"
          | "REJECTED";
      }
      if (trigger === "update" && session?.user) {
        token.role = session.user.role;
        token.status = session.user.status;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "MEMBER" | "ADMIN";
        session.user.status = token.status as
          | "PENDING"
          | "APPROVED"
          | "REJECTED";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
