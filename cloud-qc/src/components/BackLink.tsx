import Link from "next/link";

/** Persistent "← Back to X" affordance at the top of a detail page.
 *  Shown at all breakpoints; matters most on mobile where the sidebar
 *  is collapsed. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="back-link">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M15 18l-6-6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back to {label}
    </Link>
  );
}
