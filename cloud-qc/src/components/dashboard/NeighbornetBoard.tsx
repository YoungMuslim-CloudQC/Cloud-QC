"use client";

import Link from "next/link";
import { useState } from "react";

import { statusMeta } from "@/lib/format";
import { NetworkMap, type MapNeighbornet } from "@/components/NetworkMap";

export function NeighbornetBoard({
  neighbornets,
}: {
  neighbornets: MapNeighbornet[];
}) {
  const [view, setView] = useState<"grid" | "map">("grid");

  return (
    <>
      <div className="section-label">
        <span>Neighbornets</span>
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
          <div className="nn-grid">
            {neighbornets.map((n) => {
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
        )
      ) : (
        <NetworkMap neighbornets={neighbornets} />
      )}
    </>
  );
}
