"use client";

import { useMemo, useState } from "react";

import { ragColor } from "@/lib/format";

type OrbitNode = {
  id: string;
  name: string;
  status: string | null;
  region: string;
  subArea: string | null;
  visitCount: number;
};

// Fixed display order for the regions we know about; anything unrecognized
// (shouldn't happen, but data can surprise you) is appended after.
const REGION_ORDER = ["Northeast", "Southeast", "Texas", "Midwest", "West"];

/** Small stable hash so each node's animation timing looks random but never
 *  changes between renders (avoids hydration mismatches Math.random() would
 *  cause, and keeps a given neighbornet "wiggling" the same way every time). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** More nodes sharing a cell -> smaller dots (and smaller name labels), so a
 *  crowded sub-area doesn't just overlap into a blob. */
function dotRadiusFor(count: number): number {
  if (count <= 6) return 15;
  if (count <= 12) return 11;
  if (count <= 24) return 8;
  return 6;
}

// Motion "character" by status — red is agitated, green is calm, yellow sits
// in between, and a never-rated neighbornet barely moves at all (nothing to
// report yet). Base durations are seconds per cycle; visit count then speeds
// a node up slightly further (more activity -> more "alive"), clamped so a
// busy urgent neighbornet never gets so fast it's hard to read.
const DRIFT_BY_STATUS: Record<string, { keyframe: string; baseDuration: number; floor: number }> = {
  URGENT: { keyframe: "orbit-drift-erratic", baseDuration: 3.4, floor: 2.4 },
  NEEDS_FOLLOWUP: { keyframe: "orbit-drift-medium", baseDuration: 4.8, floor: 3.4 },
  ON_TRACK: { keyframe: "orbit-drift-calm", baseDuration: 6.5, floor: 5 },
};
const DRIFT_DORMANT = { keyframe: "orbit-drift-dormant", baseDuration: 9, floor: 7.5 };

function driftFor(status: string | null, visitCount: number) {
  const d = status ? (DRIFT_BY_STATUS[status] ?? DRIFT_DORMANT) : DRIFT_DORMANT;
  const duration = Math.max(d.floor, d.baseDuration - Math.min(visitCount, 6) * 0.12);
  return { keyframe: d.keyframe, duration };
}

type PositionedNode = OrbitNode & {
  x: number;
  y: number;
  angle: number;
  dotR: number;
  fontSize: number;
};

type Cell = {
  subArea: string;
  region: string;
  radius: number;
  hubR: number;
  size: number;
  nodes: PositionedNode[];
};

function buildCell(subArea: string, region: string, cellNodes: OrbitNode[]): Cell {
  const count = cellNodes.length;
  const dotR = dotRadiusFor(count);
  const hubR = count <= 3 ? 16 : 20;
  const minRadius = ((2 * dotR + 8) * count) / (2 * Math.PI);
  const radius = Math.max(hubR + dotR + 14, minRadius);
  const fontSize = Math.max(7, Math.min(10, dotR + 1));

  const nodes: PositionedNode[] = cellNodes.map((n, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + 0.35;
    return {
      ...n,
      angle,
      dotR,
      fontSize,
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  });

  // Extra padding beyond the outermost dot so its name label has room to sit
  // outside the ring instead of being clipped by the viewBox edge.
  const size = Math.max(120, (radius + dotR) * 2 + 130);

  return { subArea, region, radius, hubR, size, nodes };
}

export function Orbit({ nodes }: { nodes: OrbitNode[] }) {
  const regionMap = useMemo(() => {
    const bySubArea = new Map<string, { region: string; subArea: string }>();
    for (const n of nodes) {
      if (!n.subArea) continue;
      bySubArea.set(n.subArea, { region: n.region, subArea: n.subArea });
    }
    const known = REGION_ORDER.filter((r) => [...bySubArea.values()].some((s) => s.region === r));
    const unknown = [...new Set([...bySubArea.values()].map((s) => s.region))]
      .filter((r) => !REGION_ORDER.includes(r))
      .sort();
    const regions = [...known, ...unknown];
    return regions.map((region) => ({
      region,
      subAreas: [...bySubArea.values()]
        .filter((s) => s.region === region)
        .map((s) => s.subArea)
        .sort(),
    }));
  }, [nodes]);

  const allSubAreas = useMemo(() => regionMap.flatMap((r) => r.subAreas), [regionMap]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allSubAreas));

  function toggleSubArea(subArea: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subArea)) next.delete(subArea);
      else next.add(subArea);
      return next;
    });
  }

  const cells = useMemo(() => {
    return regionMap
      .flatMap((r) => r.subAreas.map((subArea) => ({ region: r.region, subArea })))
      .filter((s) => selected.has(s.subArea))
      .map(({ region, subArea }) =>
        buildCell(
          subArea,
          region,
          nodes.filter((n) => n.subArea === subArea),
        ),
      );
  }, [regionMap, selected, nodes]);

  return (
    <div>
      {allSubAreas.length > 1 && (
        <div className="region-pick-grid orbit-subarea-toggles">
          {regionMap.map((r) => (
            <div key={r.region}>
              <div className="region-pick-heading">{r.region}</div>
              {r.subAreas.map((a) => (
                <label key={a} className="region-pick-item">
                  <input
                    type="checkbox"
                    checked={selected.has(a)}
                    onChange={() => toggleSubArea(a)}
                  />
                  {a}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}

      {cells.length === 0 ? (
        <div className="empty-state" style={{ padding: "24px 0" }}>
          Pick an area above to see its neighbornets.
        </div>
      ) : (
        <div className="orbit-cells-wrap">
          {cells.map((cell) => (
            <OrbitCell key={cell.subArea} cell={cell} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrbitCell({ cell }: { cell: Cell }) {
  const cx = cell.size / 2;
  const cy = cell.size / 2;

  return (
    <div className="orbit-cell">
      <div className="orbit-cell-title">{cell.subArea}</div>
      <svg
        viewBox={`0 0 ${cell.size} ${cell.size}`}
        style={{ width: "100%", height: "auto", display: "block" }}
      >
        <circle
          className="orbit-animated"
          cx={cx}
          cy={cy}
          r={cell.radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={1}
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: "orbit-membrane 7s ease-in-out infinite",
          }}
        />

        {cell.nodes.map((n) => (
          <line
            key={`l-${n.id}`}
            x1={cx}
            y1={cy}
            x2={cx + n.x}
            y2={cy + n.y}
            stroke="var(--border)"
            strokeWidth={1.2}
            opacity={0.6}
          />
        ))}

        <circle
          className="orbit-animated"
          cx={cx}
          cy={cy}
          r={cell.hubR}
          fill="var(--primary)"
          style={{
            filter: "drop-shadow(0 0 8px rgba(var(--primary-rgb), 0.6))",
            transformOrigin: `${cx}px ${cy}px`,
            animation: "orbit-pulse 5s ease-in-out infinite",
          }}
        />

        {cell.nodes.map((n) => {
          const h = hashStr(n.id);
          const { keyframe, duration } = driftFor(n.status, n.visitCount);
          const delay = (h % 25) / 10;
          const nx = cx + n.x;
          const ny = cy + n.y;
          // Name sits radially outside the dot, on the same angle as the
          // node — fans labels out and away from each other.
          const labelR = Math.hypot(n.x, n.y) + n.dotR + 5;
          const lx = cx + labelR * Math.cos(n.angle);
          const ly = cy + labelR * Math.sin(n.angle);
          const cos = Math.cos(n.angle);
          const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";
          return (
            <g key={`n-${n.id}`}>
              <circle
                className="orbit-animated"
                cx={nx}
                cy={ny}
                r={n.dotR}
                fill={ragColor(n.status)}
                style={{
                  transformOrigin: `${nx}px ${ny}px`,
                  animation: `${keyframe} ${duration}s ease-in-out infinite`,
                  animationDelay: `${delay}s`,
                }}
              >
                <title>{n.name}</title>
              </circle>
              <text
                x={lx}
                y={ly}
                textAnchor={anchor}
                dominantBaseline="middle"
                fontFamily="var(--font-body), sans-serif"
                fontSize={n.fontSize}
                fill="var(--text-muted)"
              >
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
