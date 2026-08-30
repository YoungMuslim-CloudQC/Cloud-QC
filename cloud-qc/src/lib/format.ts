export function initials(nameOrEmail: string): string {
  const base = nameOrEmail.includes("@")
    ? nameOrEmail.split("@")[0]
    : nameOrEmail;
  const parts = base.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const VISIT_STATUS_META = {
  ON_TRACK: { label: "On track", cls: "badge-success" },
  NEEDS_FOLLOWUP: { label: "Needs follow-up", cls: "badge-warn" },
  URGENT: { label: "Urgent", cls: "badge-urgent" },
} as const;

export function statusMeta(status: string | null | undefined) {
  if (status && status in VISIT_STATUS_META) {
    return VISIT_STATUS_META[status as keyof typeof VISIT_STATUS_META];
  }
  return { label: "Not rated", cls: "badge-neutral" } as const;
}

export function ragColor(status: string | null | undefined): string {
  switch (status) {
    case "ON_TRACK":
      return "#34D399";
    case "NEEDS_FOLLOWUP":
      return "#FBBF24";
    case "URGENT":
      return "#FB7185";
    default:
      return "#948CBB";
  }
}

/** YYYY-MM-DD from a Date, in UTC (dates are stored as @db.Date). */
export function isoDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}
