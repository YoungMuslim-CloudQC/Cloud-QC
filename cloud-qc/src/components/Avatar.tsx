import { initials } from "@/lib/format";

/** Renders the uploaded/OAuth photo when there is one, else the initials
 *  circle every avatar in the app used to always show. */
export function Avatar({
  name,
  image,
  className = "",
}: {
  name: string;
  image?: string | null;
  className?: string;
}) {
  if (image) {
    return (
      // avatar sources are arbitrary (Google CDN or Vercel Blob) — not worth
      // a next/image remotePatterns entry for a 34px circle.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className={`avatar-circle avatar-photo ${className}`.trim()}
      />
    );
  }
  return (
    <div className={`avatar-circle ${className}`.trim()}>{initials(name)}</div>
  );
}
