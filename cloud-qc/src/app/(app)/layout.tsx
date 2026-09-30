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
import { ViewAsBanner } from "@/components/ViewAsBanner";
import { WhatsNew } from "@/components/WhatsNew";
import { hasUnseenRelease, LATEST_RELEASE } from "@/lib/changelog";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireApprovedAny();
  const isAdmin = user.role === "ADMIN";
  const isCoordinator = user.scope.viewOnly && user.role !== "ADMIN";
  const pendingCount = isAdmin
    ? await db.user.count({ where: { status: "PENDING" } })
    : 0;

  const displayName = user.name || user.email || "Member";

  // Announce a release only to people who were already here before it —
  // someone signing in for the first time wants the app, not a changelog.
  // Suppressed while an admin is viewing as someone: it'd be announcing to
  // the wrong person, against the wrong read state.
  const seen = user.impersonating
    ? null
    : await db.user.findUnique({
        where: { id: user.id },
        select: { lastSeenChangelog: true },
      });
  const unseenRelease =
    seen && hasUnseenRelease(seen.lastSeenChangelog) ? LATEST_RELEASE : null;

  return (
    <div className={`app${user.impersonating ? " has-view-as" : ""}`}>
      {user.impersonating && <ViewAsBanner impersonating={user.impersonating} />}
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
          isLead={user.scope.cloudLead}
          pendingCount={pendingCount}
        />

        <SignOutButton />
        <div className="sidebar-footer">
          {isAdmin ? "Admin access" : isCoordinator ? "Coordinator" : "Cloud member"}{" "}
          &middot; signed in as{" "}
          {user.email}
        </div>
      </aside>

      <MobileNav isAdmin={isAdmin} isCoordinator={isCoordinator} isLead={user.scope.cloudLead} />

      <main className="main">{children}</main>

      <SiteFeedbackWidget />
      {unseenRelease && <WhatsNew release={unseenRelease} />}
    </div>
  );
}
