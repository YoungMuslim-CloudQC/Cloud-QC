import type { DefaultSession } from "next-auth";

type UserRole = "MEMBER" | "ADMIN";
type UserStatus = "PENDING" | "APPROVED" | "REJECTED";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    status?: UserStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    status: UserStatus;
  }
}
