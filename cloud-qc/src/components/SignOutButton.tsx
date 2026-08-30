"use client";

import { signOut } from "next-auth/react";

export function SignOutButton({
  className = "btn-logout",
  children = "Log out",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => void signOut({ redirectTo: "/login" })}
    >
      {children}
    </button>
  );
}
