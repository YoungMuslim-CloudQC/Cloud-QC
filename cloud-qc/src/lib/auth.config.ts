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

if (googleEnabled) {
  providers.push(
    Google({
      // Same email via Google or password links to one account. Safe here
      // because Google verifies email ownership.
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export default {
  providers,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
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
