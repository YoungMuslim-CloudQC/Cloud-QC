"use client";

import { useState } from "react";

import { initials } from "@/lib/format";

/** Renders the uploaded/OAuth photo when there is one, else the initials
 *  circle every avatar in the app used to always show.
 *
 *  A client component purely so a photo that stops resolving falls back to
 *  the initials instead of a broken-image icon. Stored URLs do go dead —
 *  a Google CDN link expires, a blob gets cleaned up — and until this was
 *  handled the org chart rendered a torn-page glyph where a face belonged. */
export function Avatar({
  name,
  image,
  className = "",
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);

  if (image && !broken) {
    return (
      // avatar sources are arbitrary (Google CDN or Vercel Blob) — not worth
      // a next/image remotePatterns entry for a 34px circle.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className={`avatar-circle avatar-photo ${className}`.trim()}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className={`avatar-circle ${className}`.trim()}>{initials(name)}</div>
  );
}
