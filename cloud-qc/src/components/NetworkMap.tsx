"use client";

import { geoMercator, geoPath } from "d3-geo";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection, Feature, Geometry } from "geojson";

import { ragColor, statusMeta } from "@/lib/format";

export type MapNeighbornet = {
  id: string;
  name: string;
  subArea: string;
  region: string;
  stateCode: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string | null;
  lastVisitDate: string | null;
  partners: string[];
};

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi",
  MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma",
  OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin",
  WY: "Wyoming", DC: "District of Columbia",
};


function hasCoords(n: MapNeighbornet): n is MapNeighbornet & {
  latitude: number;
  longitude: number;
} {
  return (
    typeof n.latitude === "number" &&
    typeof n.longitude === "number" &&
    !Number.isNaN(n.latitude) &&
    !Number.isNaN(n.longitude)
  );
}

function RegionFallback({ neighbornets }: { neighbornets: MapNeighbornet[] }) {
  const byRegion = new Map<string, Map<string, MapNeighbornet[]>>();
  for (const n of neighbornets) {
    const r = n.region || "Unassigned region";
    const a = n.subArea || "Unassigned area";
    if (!byRegion.has(r)) byRegion.set(r, new Map());
    const areas = byRegion.get(r)!;
    if (!areas.has(a)) areas.set(a, []);
    areas.get(a)!.push(n);
  }

  return (
    <>
      {[...byRegion.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([region, areas]) => {
          const count = [...areas.values()].reduce((s, x) => s + x.length, 0);
          return (
            <div className="region-card" key={region}>
              <div className="region-title">
                {region}
                <span className="region-count">
                  {count} neighbornet{count === 1 ? "" : "s"}
                </span>
              </div>
              {[...areas.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([area, pins]) => (
                  <div className="area-block" key={area}>
                    <div className="area-title">{area}</div>
                    <div className="nn-pin-wrap">
                      {pins.map((n) => {
                        const c = ragColor(n.status);
                        return (
                          <Link
                            className="nn-pin"
                            href={`/neighbornets/${n.id}`}
                            key={n.id}
                          >
                            <span
                              className="nn-pin-dot"
                              style={{ background: c, boxShadow: `0 0 6px ${c}` }}
                            />
                            {n.name}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          );
        })}
    </>
  );
}

const WIDTH = 900;
const HEIGHT = 700;

function GeoMap({
  stateFeature,
  points,
  onSelect,
}: {
  stateFeature: Feature<Geometry>;
  points: (MapNeighbornet & { latitude: number; longitude: number })[];
  onSelect: (n: MapNeighbornet) => void;
}) {
  const { pathD, laid } = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [
        [70, 40],
        [WIDTH - 70, HEIGHT - 40],
      ],
      stateFeature,
    );
    const pathGen = geoPath(projection);
    const d = pathGen(stateFeature) ?? "";
    const bounds = pathGen.bounds(stateFeature);
    const centerX = (bounds[0][0] + bounds[1][0]) / 2;

    const projected = points
      .map((n) => {
        const xy = projection([n.longitude, n.latitude]);
        return xy ? { ...n, x: xy[0], y: xy[1] } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    const left = projected
      .filter((p) => p.x < centerX)
      .sort((a, b) => a.y - b.y);
    const right = projected
      .filter((p) => p.x >= centerX)
      .sort((a, b) => a.y - b.y);
    const topPad = 46;
    const spacing = 40;
    const layout = (arr: typeof projected, side: "left" | "right") =>
      arr.map((p, i) => ({
        ...p,
        labelY: topPad + i * spacing,
        labelX: side === "left" ? 34 : WIDTH - 34,
        side,
      }));

    return {
      pathD: d,
      laid: [...layout(left, "left"), ...layout(right, "right")],
    };
  }, [stateFeature, points]);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <filter id="stateGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d={pathD}
        fill="rgba(139,92,246,0.10)"
        stroke="#8B5CF6"
        strokeWidth={2.2}
        filter="url(#stateGlow)"
      />
      {laid.map((p) => {
        const bendX =
          p.side === "left"
            ? Math.max(p.x - 70, p.labelX + 90)
            : Math.min(p.x + 70, p.labelX - 90);
        return (
          <path
            key={`line-${p.id}`}
            d={`M ${p.x} ${p.y} L ${bendX} ${p.labelY} L ${p.labelX} ${p.labelY}`}
            fill="none"
            stroke="#C9A227"
            strokeWidth={1.2}
            opacity={0.65}
          />
        );
      })}
      {laid.map((p) => {
        const c = ragColor(p.status);
        return (
          <g
            key={`dot-${p.id}`}
            style={{ cursor: "pointer" }}
            onClick={() => onSelect(p)}
          >
            <circle cx={p.x} cy={p.y} r={10} fill={c} opacity={0.22} />
            <circle
              cx={p.x}
              cy={p.y}
              r={5}
              fill={c}
              stroke="#170F32"
              strokeWidth={1.5}
              style={{ filter: `drop-shadow(0 0 6px ${c})` }}
            />
          </g>
        );
      })}
      {laid.map((p) => (
        <text
          key={`label-${p.id}`}
          x={p.labelX}
          y={p.labelY + 4}
          textAnchor={p.side === "left" ? "start" : "end"}
          fontFamily="var(--font-display), sans-serif"
          fontSize={13}
          fontWeight={600}
          fill="#F5F3FF"
          style={{ cursor: "pointer" }}
          onClick={() => onSelect(p)}
        >
          {p.name}
        </text>
      ))}
    </svg>
  );
}

function DetailPanel({ n }: { n: MapNeighbornet | null }) {
  if (!n) {
    return (
      <div className="empty-state" style={{ padding: "16px 6px" }}>
        <strong>Tap a pin</strong>
        See quick details for a neighbornet here.
      </div>
    );
  }
  const meta = statusMeta(n.status);
  return (
    <div>
      <div
        className="font-display"
        style={{ fontWeight: 700, fontSize: 15, color: "#F5F3FF" }}
      >
        {n.name}
      </div>
      <div
        style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 10 }}
      >
        {n.subArea}
      </div>
      <div style={{ marginBottom: 10 }}>
        <span className={`badge ${meta.cls}`}>{meta.label}</span>
      </div>
      <div style={{ fontSize: 12.5, marginBottom: 6 }}>
        <strong>Last visit:</strong> {n.lastVisitDate ?? "—"}
      </div>
      <div style={{ fontSize: 12.5, marginBottom: 6 }}>
        <strong>Partners:</strong>{" "}
        {n.partners.length ? n.partners.join(", ") : "Unassigned"}
      </div>
      <Link
        className="btn btn-secondary btn-small"
        href={`/neighbornets/${n.id}`}
        style={{ marginTop: 8, display: "inline-block" }}
      >
        Open full details
      </Link>
    </div>
  );
}

export function NetworkMap({
  neighbornets,
}: {
  neighbornets: MapNeighbornet[];
}) {
  const withCoords = neighbornets.filter(hasCoords);
  const missing = neighbornets.filter((n) => !hasCoords(n));

  const states = useMemo(
    () =>
      [...new Set(withCoords.map((n) => (n.stateCode || "").toUpperCase()))]
        .filter(Boolean)
        .sort(),
    [withCoords],
  );

  const [selectedState, setSelectedState] = useState<string>("");
  const [selected, setSelected] = useState<MapNeighbornet | null>(null);
  const [topo, setTopo] = useState<Topology | null>(null);
  const [topoError, setTopoError] = useState(false);

  // Derive the effective state rather than storing a value that can go stale.
  const effectiveState =
    selectedState && states.includes(selectedState)
      ? selectedState
      : (states[0] ?? "");

  useEffect(() => {
    if (!withCoords.length || topo) return;
    let cancelled = false;
    import("us-atlas/states-10m.json")
      .then((m) => {
        if (!cancelled) setTopo(m.default as unknown as Topology);
      })
      .catch(() => {
        if (!cancelled) setTopoError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [withCoords.length, topo]);

  if (!neighbornets.length) {
    return (
      <div className="empty-state">
        <strong>No neighbornets yet</strong>
        They will appear here once added.
      </div>
    );
  }

  if (!withCoords.length) {
    return (
      <>
        <div className="empty-state" style={{ marginBottom: 16 }}>
          <strong>No coordinates yet</strong>
          Add latitude/longitude to a neighbornet to see the real map. Showing
          the region view instead.
        </div>
        <RegionFallback neighbornets={neighbornets} />
      </>
    );
  }

  const fullName = STATE_NAMES[effectiveState] || effectiveState;
  const statesGeo = topo
    ? (feature(
        topo,
        topo.objects.states as GeometryCollection,
      ) as FeatureCollection<Geometry>)
    : null;
  const stateFeature =
    statesGeo?.features.find(
      (f) => (f.properties as { name?: string } | null)?.name === fullName,
    ) ?? null;
  const statePoints = withCoords.filter(
    (n) => (n.stateCode || "").toUpperCase() === effectiveState,
  );

  return (
    <>
      <div className="map-state-bar">
        <label>State</label>
        <select
          value={effectiveState}
          onChange={(e) => {
            setSelectedState(e.target.value);
            setSelected(null);
          }}
        >
          {states.map((s) => (
            <option key={s} value={s}>
              {STATE_NAMES[s] || s}
            </option>
          ))}
        </select>
      </div>

      <div className="geo-map-layout">
        <div className="geo-map-main">
          <div className="geo-map-card">
            {topoError ? (
              <div className="empty-state">
                <strong>Could not load map data</strong>
                Try refreshing the page.
              </div>
            ) : !statesGeo ? (
              <div className="geo-empty">Loading map…</div>
            ) : !stateFeature ? (
              <div className="empty-state">
                <strong>Could not find &ldquo;{fullName}&rdquo;</strong>
                Check the state field on those neighbornets.
              </div>
            ) : (
              <GeoMap
                stateFeature={stateFeature}
                points={statePoints}
                onSelect={setSelected}
              />
            )}
          </div>
          {missing.length > 0 && (
            <div
              style={{
                marginTop: 10,
                fontSize: 11.5,
                color: "var(--text-muted)",
              }}
            >
              Not on the map yet (missing coordinates):{" "}
              {missing.map((n) => n.name).join(", ")}
            </div>
          )}
        </div>
        <div className="geo-map-side">
          <DetailPanel n={selected} />
        </div>
      </div>
    </>
  );
}
