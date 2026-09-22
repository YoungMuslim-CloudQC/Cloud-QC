import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { assertAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

const PREFIX = "data:image/jpeg;base64,";

/** Admin-only: serves a feedback item's screenshot as a real image so the
 *  list page can lazy-load thumbnails instead of embedding megabytes. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    await assertAdmin();
  } catch {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { id } = await ctx.params;
  const row = await db.siteFeedback.findUnique({
    where: { id },
    select: { screenshot: true },
  });
  if (!row?.screenshot?.startsWith(PREFIX)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const bytes = Buffer.from(row.screenshot.slice(PREFIX.length), "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
