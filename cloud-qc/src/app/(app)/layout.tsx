import { db } from "@/lib/db";
import { requireApproved } from "@/lib/authz";

// Every screen here is behind auth and renders live data.
export const dynamic = "force-dynamic";
import { initials } from "@/lib/format";
import { CloudMark } from "@/components/Brand";
import { SidebarNav, MobileNav } from "@/components/AppNav";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireApproved();
  const isAdmin = user.role === "ADMIN";
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

        <div className="sidebar-user">
          <div className="avatar-circle">{initials(displayName)}</div>
          <span style={{ fontSize: "12.5px", fontWeight: 600 }}>
            {displayName}
          </span>
        </div>

        <SidebarNav isAdmin={isAdmin} pendingCount={pendingCount} />

        <SignOutButton />
        <div className="sidebar-footer">
          {isAdmin ? "Admin access" : "Cloud member"} &middot; signed in as{" "}
          {user.email}
        </div>
      </aside>

      <MobileNav isAdmin={isAdmin} />

      <main className="main">{children}</main>
    </div>
  );
}
