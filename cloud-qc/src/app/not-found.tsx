import Link from "next/link";

import { PixelMascot } from "@/components/PixelMascot";

/** 404 — a dead link, or a neighbornet/visit that's since been removed. */
export default function NotFound() {
  return (
    <div className="oops">
      <PixelMascot />
      <h1 className="oops-title">Nothing here</h1>
      <p className="oops-sub">
        This page doesn&rsquo;t exist — the link may be out of date, or whatever
        it pointed at has been deleted or archived since.
      </p>
      <div className="oops-actions">
        <Link className="btn btn-primary" href="/dashboard" style={{ width: "auto" }}>
          Back to dashboard
        </Link>
        <Link className="btn btn-secondary" href="/neighbornets">
          Browse neighbornets
        </Link>
      </div>
    </div>
  );
}
