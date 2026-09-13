import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { verify } from "@node-rs/argon2";
import { z } from "zod";

import { db } from "@/lib/db";
import authConfig from "@/lib/auth.config";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const ok = await verify(user.passwordHash, parsed.data.password);
        if (!ok) return null;

        // Pending / rejected users are allowed to obtain a session but are
        // bounced to /pending by the proxy and blocked by requireApproved().
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          status: user.status,
          theme: user.theme,
        };
      },
    }),
  ],
});
