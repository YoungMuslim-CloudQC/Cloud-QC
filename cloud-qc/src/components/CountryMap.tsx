"use client";

import { geoAlbersUsa, geoPath } from "d3-geo";
import { useEffect, useState } from "react";
import type { Topology } from "topojson-specification";

import {
  STATE_NAMES,
  NAME_TO_CODE,
  allStatesCollection,
  loadStatesTopo,
} from "@/lib/us-map";

export type StateStat = {
  total: number;
  onTrack: number;
  needsFollowup: number;
  urgent: number;
  unrated: number;
};

const W = 960;
const H = 560;

export function CountryMap({
  stateStats,
  onDrill,
}: {
  stateStats: Record<string, StateStat>;
  onDrill: (stateCode: string) => void;
}) {
  const [topo, setTopo] = useState<Topology | null>(null);
  const [topoError, setTopoError] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStatesTopo()
      .then((t) => !cancelled && setTopo(t))
      .catch(() => !cancelled && setTopoError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCount = Object.keys(stateStats).length;

  let shapes: {
    code: string | null;
    name: string;
    d: string;
    stat: StateStat | null;
  }[] = [];
  if (topo) {
    const fc = allStatesCollection(topo);
    const projection = geoAlbersUsa().fitSize([W, H], fc);
    const pathGen = geoPath(projection);
    shapes = fc.features.map((f) => {
      const name = (f.properties as { name?: string } | null)?.name ?? "";
      const code = NAME_TO_CODE[name] ?? null;
      return {
        code,
        name,
        d: pathGen(f) ?? "",
        stat: code ? (stateStats[code] ?? null) : null,
      };
    });
  }

  const hoveredStat = hovered ? stateStats[hovered] : null;

  return (
    <>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--text-muted)",
          marginBottom: 12,
        }}
      >
        {activeCount === 0
          ? "No neighbornets have a location yet."
          : `${activeCount} state${activeCount === 1 ? "" : "s"} with neighbornets — highlighted. Click one to drill in.`}
      </div>

      <div className="geo-map-layout">
        <div className="geo-map-main">
          <div className="geo-map-card">
            {topoError ? (
              <div className="empty-state">
                <strong>Could not load map data</strong>
                Try refreshing the page.
              </div>
            ) : !topo ? (
              <div className="geo-empty">Loading map…</div>
            ) : (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                style={{ width: "100%", height: "auto", display: "block" }}
                onMouseLeave={() => setHovered(null)}
              >
                {shapes.map((s) => {
                  const active = s.stat != null;
                  const isHover = hovered === s.code;
                  return (
                    <path
                      key={s.name}
                      d={s.d}
                      fill={
                        active
                          ? isHover
                            ? "rgba(139,92,246,0.45)"
                            : "rgba(139,92,246,0.22)"
                          : "rgba(148,140,187,0.06)"
                      }
                      stroke={active ? "#8B5CF6" : "#3A3363"}
                      strokeWidth={active ? 1.4 : 0.8}
                      style={{ cursor: active ? "pointer" : "default" }}
                      onMouseEnter={() =>
                        active && s.code && setHovered(s.code)
                      }
                      onClick={() => active && s.code && onDrill(s.code)}
                    />
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        <div className="geo-map-side">
          {hoveredStat && hovered ? (
            <div>
              <div
                className="font-display"
                style={{ fontWeight: 700, fontSize: 15, color: "#F5F3FF" }}
              >
                {STATE_NAMES[hovered] ?? hovered}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  marginBottom: 12,
                }}
              >
                {hoveredStat.total} neighbornet
                {hoveredStat.total === 1 ? "" : "s"}
              </div>

              <StatLine
                label="On track"
                value={hoveredStat.onTrack}
                cls="badge-success"
              />
              <StatLine
                label="Needs follow-up"
                value={hoveredStat.needsFollowup}
                cls="badge-warn"
              />
              <StatLine
                label="Urgent"
                value={hoveredStat.urgent}
                cls="badge-urgent"
              />
              {hoveredStat.unrated > 0 && (
                <StatLine
                  label="No visits yet"
                  value={hoveredStat.unrated}
                  cls="badge-neutral"
                />
              )}

              <button
                type="button"
                className="btn btn-secondary btn-small"
                style={{ marginTop: 12, width: "auto" }}
                onClick={() => onDrill(hovered)}
              >
                Open {STATE_NAMES[hovered] ?? hovered}
              </button>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: "16px 6px" }}>
              <strong>Hover a state</strong>
              Highlighted states have at least one neighbornet.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function StatLine({
  label,
  value,
  cls,
}: {
  label: string;
  value: number;
  cls: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: 12.5,
        padding: "4px 0",
      }}
    >
      <span className={`badge ${cls}`}>{label}</span>
      <span className="cell-mono">{value}</span>
    </div>
  );
}
