"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { statusMeta } from "@/lib/format";
import { subValue } from "@/lib/sub-regions";
import { NetworkMap, type MapNeighbornet } from "@/components/NetworkMap";

/** How many cards to show before handing off to /neighbornets. Dumping all
 *  of them here ran to twenty-odd phone-screens once the directory went
 *  national, which is what made a member's own neighbornet impossible to
 *  find on the dashboard. */
const GRID_LIMIT = 9;

export function NeighbornetBoard({
  neighbornets,
  homeSubArea,
}: {
  neighbornets: MapNeighbornet[];
  /** The viewer's own sub-region — what the grid opens scoped to. */
  homeSubArea?: string | null;
}) {
  const [view, setView] = useState<"grid" | "map">("grid");
  const [scoped, setScoped] = useState(true);

  const inHome = useMemo(
    () =>
      homeSubArea
        ? neighbornets.filter((n) => n.subArea === homeSubArea)
        : [],
    [neighbornets, homeSubArea],
  );

  // Scope to the viewer's sub-region when they have one with anything in it;
  // otherwise there's nothing to narrow to and the full list is the list.
  const canScope = scoped && inHome.length > 0;
  const shown = canScope ? inHome : neighbornets;
  const visible = shown.slice(0, GRID_LIMIT);
  const hidden = shown.length - visible.length;

  return (
    <>
      <div className="section-label">
        <span>
          Neighbornets
          {canScope && (
            <span className="optional-tag"> · {homeSubArea}</span>
          )}
        </span>
        <div className="view-toggle">
          <button
            type="button"
            className={`view-toggle-btn${view === "grid" ? " active" : ""}`}
            onClick={() => setView("grid")}
          >
            Grid
          </button>
          <button
            type="button"
            className={`view-toggle-btn${view === "map" ? " active" : ""}`}
            onClick={() => setView("map")}
          >
            Map
          </button>
        </div>
      </div>

      {view === "grid" ? (
        neighbornets.length === 0 ? (
          <div className="empty-state">
            <strong>No neighbornets yet</strong>
            An admin needs to add one to get started.
          </div>
        ) : (
          <>
            <div className="nn-grid">
              {visible.map((n) => {
                const meta = n.status
                  ? statusMeta(n.status)
                  : { label: "No visits yet", cls: "badge-neutral" };
                return (
                  <Link
                    key={n.id}
                    href={`/neighbornets/${n.id}`}
                    className="nn-card"
                  >
                    <div className="nn-card-top">
                      <div>
                        <div className="nn-name">{n.name}</div>
                        <div className="nn-city">{n.subArea}</div>
                      </div>
                      <span className={`badge ${meta.cls}`}>{meta.label}</span>
                    </div>
                    <div className="nn-meta">
                      <div>Last visit: {n.lastVisitDate ?? "—"}</div>
                      <div>
                        Partners:{" "}
                        {n.partners.length
                          ? n.partners.join(", ")
                          : "Unassigned"}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="nn-board-more">
              {hidden > 0 && (
                <Link
                  className="btn btn-secondary btn-small"
                  href={
                    canScope && homeSubArea
                      ? `/neighbornets?area=${encodeURIComponent(subValue(homeSubArea))}`
                      : "/neighbornets"
                  }
                >
                  {hidden} more{canScope ? ` in ${homeSubArea}` : ""} →
                </Link>
              )}
              {inHome.length > 0 &&
                (canScope ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => setScoped(false)}
                  >
                    Show all {neighbornets.length}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => setScoped(true)}
                  >
                    Back to {homeSubArea}
                  </button>
                ))}
              <Link className="btn btn-secondary btn-small" href="/neighbornets">
                Browse all neighbornets
              </Link>
            </div>
          </>
        )
      ) : (
        <NetworkMap neighbornets={neighbornets} />
      )}
    </>
  );
}
