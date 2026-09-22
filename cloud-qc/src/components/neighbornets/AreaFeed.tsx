import Link from "next/link";

import { db } from "@/lib/db";
import { getRegionMap, memberName, type RegionMap } from "@/lib/queries";
import { isoDate, statusMeta } from "@/lib/format";
import { areaLabel, areaWhere, subRegionMatchValues } from "@/lib/sub-regions";
import {
  EVENT_TYPES,
  EVENT_TYPE_LABEL,
  type EventTypeValue,
} from "@/lib/visit-schema";

const FEED_LIMIT = 40;

/** Everything logged against the neighbornets in a sub-region, newest first —
 *  the "step two" view before drilling into a single location. Bash/SR
 *  events show up too (matched by their own subRegion, not a real NN link)
 *  since routing them back to the sub-region is the whole point. */
export async function AreaFeed({
  area,
  type,
}: {
  area: string;
  type: EventTypeValue | "";
}) {
  const regionMap: RegionMap = await getRegionMap();
  const subRegionValues = subRegionMatchValues(area, regionMap);

  const visits = await db.visit.findMany({
    where: {
      deletedAt: null,
      ...(type ? { eventType: type } : {}),
      OR: [
        { neighbornets: { some: { neighbornet: { archivedAt: null, ...areaWhere(area) } } } },
        subRegionValues ? { subRegion: { in: subRegionValues } } : { subRegion: { not: null } },
      ],
    },
    orderBy: [{ visitDate: "desc" }, { createdAt: "desc" }],
    take: FEED_LIMIT,
    include: {
      neighbornets: { include: { neighbornet: { select: { id: true, name: true } } } },
      submittedBy: { select: { name: true, email: true } },
    },
  });

  const chip = (value: EventTypeValue | "", label: string) => {
    const params = new URLSearchParams({ area });
    if (value) params.set("type", value);
    return (
      <Link
        key={value || "all"}
        href={`/neighbornets?${params.toString()}`}
        className={`status-opt${type === value ? " sel-ok" : ""}`}
        style={{ textDecoration: "none" }}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <div className="section-label">
        <span>Feedback in {areaLabel(area)}</span>
      </div>
      <div className="status-options" style={{ marginBottom: 12 }}>
        {chip("", "All")}
        {EVENT_TYPES.map((t) => chip(t, t === "VISIT" ? "Visits" : EVENT_TYPE_LABEL[t]))}
      </div>

      {visits.length === 0 ? (
        <div className="empty-state">
          <strong>No feedback yet</strong>
          Nothing has been logged here
          {type ? ` as a ${EVENT_TYPE_LABEL[type].toLowerCase()}` : ""}.
        </div>
      ) : (
        visits.map((v) => {
          const meta = statusMeta(v.status);
          return (
            <div className="feed-row" key={v.id}>
              <div className="feed-row-top">
                <Link href={`/visits/${v.id}`} className="visit-date">
                  {isoDate(v.visitDate)}
                </Link>
                {v.neighbornets.length ? (
                  v.neighbornets.map((l, i) => (
                    <span key={l.neighbornetId}>
                      {i > 0 && ", "}
                      <Link
                        href={`/neighbornets/${l.neighbornet.id}?area=${encodeURIComponent(area)}`}
                        className="visit-nn"
                      >
                        {l.neighbornet.name}
                      </Link>
                    </span>
                  ))
                ) : (
                  <span className="visit-nn">{v.subRegion ?? "Sub-region event"}</span>
                )}
                <span className={`badge ${meta.cls}`}>{meta.label}</span>
                {v.eventType !== "VISIT" && (
                  <span className="badge badge-event">
                    {EVENT_TYPE_LABEL[v.eventType]}
                  </span>
                )}
              </div>
              <div className="feed-row-note">
                {v.notes.length > 160 ? `${v.notes.slice(0, 160)}…` : v.notes}
              </div>
              <div className="visit-sub">by {memberName(v.submittedBy)}</div>
            </div>
          );
        })
      )}
      {visits.length === FEED_LIMIT && (
        <div className="survey-time-note" style={{ marginTop: 8 }}>
          Showing the latest {FEED_LIMIT}. Pick a neighbornet for its full history.
        </div>
      )}
    </>
  );
}
