import type { DefaultSession } from "next-auth";

type UserRole = "MEMBER" | "ADMIN" | "COORDINATOR";
type UserStatus = "PENDING" | "APPROVED" | "REJECTED";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
      theme: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
    status?: UserStatus;
    theme?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    status: UserStatus;
    theme: string;
  }
}
