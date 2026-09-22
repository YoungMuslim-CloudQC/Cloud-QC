import Link from "next/link";

import { db } from "@/lib/db";
import { requireApprovedAny } from "@/lib/authz";

// Every screen here is behind auth and renders live data.
export const dynamic = "force-dynamic";
import { CloudMark } from "@/components/Brand";
import { Avatar } from "@/components/Avatar";
import { SidebarNav, MobileNav } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";
import { SiteFeedbackWidget } from "@/components/site-feedback/SiteFeedbackWidget";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireApprovedAny();
  const isAdmin = user.role === "ADMIN";
  const isCoordinator = user.role === "COORDINATOR";
  const pendingCount = isAdmin
    ? await db.user.count({ where: { status: "PENDING" } })
    : 0;

  const displayName = user.name || user.email || "Member";

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <CloudMark />
            Cloud QC
          </div>
          <div className="brand-sub">Young Muslim &middot; QC Ops</div>
        </div>

        <Link href="/profile" className="sidebar-user">
          <Avatar name={displayName} image={user.image} />
          <span style={{ fontSize: "12.5px", fontWeight: 600 }}>
            {displayName}
          </span>
        </Link>

        <SidebarNav
          isAdmin={isAdmin}
          isCoordinator={isCoordinator}
          pendingCount={pendingCount}
        />

        <SignOutButton />
        <div className="sidebar-footer">
          {isAdmin ? "Admin access" : isCoordinator ? "Coordinator" : "Cloud member"}{" "}
          &middot; signed in as{" "}
          {user.email}
        </div>
      </aside>

      <MobileNav isAdmin={isAdmin} isCoordinator={isCoordinator} />

      <main className="main">{children}</main>

      <SiteFeedbackWidget />
    </div>
  );
}
