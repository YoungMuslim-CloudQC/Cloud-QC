"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { SignOutButton } from "@/components/SignOutButton";

type NavKey =
  | "dashboard"
  | "feedback"
  | "neighbornets"
  | "map"
  | "team"
  | "rotation"
  | "profile"
  | "admin"
  | "inbox";

type NavDef = {
  key: NavKey;
  href: string;
  label: string;
  short: string;
  icon: ReactNode;
  admin?: boolean;
  /** Only coordinators see this; members never do. */
  coordinatorOnly?: boolean;
  primaryMobile?: boolean;
};

const NAV: NavDef[] = [
  {
    key: "inbox",
    href: "/coordinator",
    label: "Feedback inbox",
    short: "Inbox",
    coordinatorOnly: true,
    primaryMobile: true,
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path d="M3 13l3-8h12l3 8v6H3v-6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M3 13h5l1 3h6l1-3h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    short: "Home",
    primaryMobile: true,
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    key: "feedback",
    href: "/feedback",
    label: "Submit Feedback",
    short: "Feedback",
    primaryMobile: true,
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path d="M4 4h16v12H8l-4 4V4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "neighbornets",
    href: "/neighbornets",
    label: "Neighbornets",
    short: "NNs",
    primaryMobile: true,
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="6" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="18" cy="18" r="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 8.5V13M12 13L7.5 16M12 13l4.5 3" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    key: "map",
    href: "/map",
    label: "Network Map",
    short: "Map",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path d="M3 8l6-3 6 3 6-3v13l-6 3-6-3-6 3V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M9 5v13M15 8v13" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    key: "team",
    href: "/team",
    label: "Cloud Team",
    short: "Team",
    primaryMobile: true,
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16 4.5a3 3 0 0 1 0 5.9M21 20c0-2.8-2-5.1-4.5-5.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "rotation",
    href: "/rotation",
    label: "Rotation",
    short: "Rotation",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "profile",
    href: "/profile",
    label: "Profile",
    short: "Profile",
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "admin",
    href: "/admin",
    label: "Admin",
    short: "Admin",
    admin: true,
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none">
        <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
];

type Viewer = { isAdmin: boolean; isCoordinator: boolean };

/** Coordinators get just their inbox + profile; members never see the inbox. */
function visibleTo(n: NavDef, v: Viewer) {
  if (v.isCoordinator) return n.key === "inbox" || n.key === "profile";
  if (n.coordinatorOnly) return false;
  return !n.admin || v.isAdmin;
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  isAdmin,
  isCoordinator = false,
  pendingCount,
}: {
  isAdmin: boolean;
  isCoordinator?: boolean;
  pendingCount: number;
}) {
  const pathname = usePathname();
  return (
    <nav>
      {NAV.filter((n) => visibleTo(n, { isAdmin, isCoordinator })).map((n) => (
        <Link
          key={n.key}
          href={n.href}
          className={`nav-item${isActive(pathname, n.href) ? " active" : ""}`}
        >
          {n.icon}
          <span className="nav-label">{n.label}</span>
          {n.key === "admin" && pendingCount > 0 && (
            <span className="nav-admin-tag">{pendingCount}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav({
  isAdmin,
  isCoordinator = false,
}: {
  isAdmin: boolean;
  isCoordinator?: boolean;
}) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  const viewer = { isAdmin, isCoordinator };
  const primary = NAV.filter((n) => n.primaryMobile && visibleTo(n, viewer));
  const overflow = NAV.filter((n) => !n.primaryMobile && visibleTo(n, viewer));
  const overflowActive = overflow.some((n) => isActive(pathname, n.href));

  return (
    <>
      <div className="bottom-tab-bar">
        {primary.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            className={`bottom-tab-item${isActive(pathname, n.href) ? " active" : ""}`}
          >
            {n.icon}
            <span>{n.short}</span>
          </Link>
        ))}
        <button
          type="button"
          className={`bottom-tab-item${overflowActive ? " active" : ""}`}
          onClick={() => setSheetOpen(true)}
        >
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="5" cy="12" r="1.6" fill="currentColor" />
            <circle cx="12" cy="12" r="1.6" fill="currentColor" />
            <circle cx="19" cy="12" r="1.6" fill="currentColor" />
          </svg>
          <span>More</span>
        </button>
      </div>

      <div
        className={`sheet-backdrop${sheetOpen ? " show" : ""}`}
        onClick={() => setSheetOpen(false)}
      />
      <div className={`more-sheet${sheetOpen ? " show" : ""}`}>
        <div className="sheet-grabber" />
        {overflow.map((n) => (
          <Link
            key={n.key}
            href={n.href}
            className="more-sheet-item"
            onClick={() => setSheetOpen(false)}
          >
            {n.icon}
            {n.label}
          </Link>
        ))}
        <div style={{ borderTop: "1px solid var(--border)", margin: "6px 0" }} />
        <SignOutButton className="more-sheet-item">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Log out
        </SignOutButton>
      </div>
    </>
  );
}
