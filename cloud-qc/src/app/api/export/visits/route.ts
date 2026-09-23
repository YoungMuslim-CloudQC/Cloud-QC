import { NextRequest } from "next/server";

import { db } from "@/lib/db";
import { assertApproved } from "@/lib/authz";
import { getRegionMap, memberName } from "@/lib/queries";
import { statusMeta, isoDate } from "@/lib/format";
import { EVENT_TYPE_LABEL } from "@/lib/visit-schema";
import { areaLabel, areaWhere, subRegionMatchValues } from "@/lib/sub-regions";
import { csvResponse } from "@/lib/export-csv";

export const dynamic = "force-dynamic";

const HEADER = [
  "Visit date",
  "Event type",
  "Neighbornet(s)",
  "Sub-region",
  "Recorded by",
  "Recorded by (email)",
  "Co-visitors",
  "Status",
  "Food rating",
  "Leadership rating",
  "Halaqah rating",
  "Group size",
  "Average age",
  "Notes",
  "Comments",
  "Feedback sent to neighbornet",
  "Logged at",
  "Visit ID",
];

/** CSV export of every logged visit/feedback record — open to any approved
 *  QC member or admin, same data any of them can already browse one visit at
 *  a time via /neighbornets and /visits/[id]. Coordinators can't reach this
 *  (assertApproved rejects them, same as every other QC screen/action). */
export async function GET(req: NextRequest) {
  try {
    await assertApproved();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const nn = searchParams.get("nn") ?? "";
  const area = searchParams.get("area") ?? "";

  const regionMap = await getRegionMap();
  const subRegionValues = subRegionMatchValues(area, regionMap);

  const scope = nn
    ? {
        OR: [
          { neighbornets: { some: { neighbornetId: nn } } },
          { mentionedNeighbornetIds: { has: nn } },
        ],
      }
    : area
      ? {
          OR: [
            { neighbornets: { some: { neighbornet: { ...areaWhere(area) } } } },
            subRegionValues ? { subRegion: { in: subRegionValues } } : { subRegion: { not: null } },
          ],
        }
      : {};

  const visits = await db.visit.findMany({
    where: { deletedAt: null, ...scope },
    orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    include: {
      neighbornets: { include: { neighbornet: { select: { name: true } } } },
      submittedBy: { select: { name: true, email: true } },
      participants: {
        where: { role: "CO_VISITOR" },
        include: { user: { select: { name: true, email: true } } },
      },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  const rows = visits.map((v) => {
    const meta = statusMeta(v.status);
    const nnNames = v.neighbornets.map((l) => l.neighbornet.name).join(", ");
    const coVisitors = v.participants.map((p) => memberName(p.user)).join("; ");
    const comments = v.comments
      .map((c) => `${memberName(c.author)}: ${c.body}`)
      .join(" | ");
    return [
      isoDate(v.visitDate),
      EVENT_TYPE_LABEL[v.eventType],
      nnNames || "—",
      v.subRegion ?? "",
      memberName(v.submittedBy),
      v.submittedBy.email ?? "",
      coVisitors,
      v.status ? meta.label : "",
      v.foodRating,
      v.leadershipRating,
      v.halaqahRating,
      v.groupSize,
      v.avgAge,
      v.notes,
      comments,
      v.feedbackSent ? "Yes" : "No",
      v.createdAt.toISOString(),
      v.id,
    ];
  });

  const scopeLabel = nn
    ? (visits[0]?.neighbornets.find((l) => l.neighbornetId === nn)?.neighbornet.name ??
        "neighbornet")
    : area
      ? areaLabel(area)
      : "all";
  const filename = `cloud-qc-feedback-${scopeLabel}-${isoDate(new Date())}.csv`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-");

  return csvResponse(filename, HEADER, rows);
}
