"use client";

import { useMemo, useState } from "react";

import { ragColor } from "@/lib/format";

type OrbitNode = { id: string; name: string; status: string | null; region: string };

// Fixed display order for the regions we know about; anything unrecognized
// (shouldn't happen, but data can surprise you) is appended after.
const REGION_ORDER = ["Northeast", "Southeast", "Texas", "Midwest", "West"];

const DRIFT_VARIANTS = ["orbit-drift-a", "orbit-drift-b", "orbit-drift-c"];

/** Small stable hash so each node's animation timing looks random but never
 *  changes between renders (avoids hydration mismatches Math.random() would
 *  cause, and keeps a given neighbornet "wiggling" the same way every time). */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** More nodes sharing a ring -> smaller dots, so a 30-neighbornet region
 *  doesn't just overlap into a blob. */
function dotRadiusFor(count: number): number {
  if (count <= 6) return 15;
  if (count <= 12) return 11;
  if (count <= 24) return 8;
  return 6;
}

export function Orbit({ nodes }: { nodes: OrbitNode[] }) {
  const regionsPresent = useMemo(() => {
    const set = new Set(nodes.map((n) => n.region));
    const known = REGION_ORDER.filter((r) => set.has(r));
    const unknown = [...set].filter((r) => !REGION_ORDER.includes(r)).sort();
    return [...known, ...unknown];
  }, [nodes]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(regionsPresent));

  function toggleRegion(region: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  const activeRegions = regionsPresent.filter((r) => selected.has(r));

  // Lay out one ring per active region, each pushed out far enough that the
  // previous ring's dots (whatever size they ended up) don't collide with it.
  const rings = useMemo(() => {
    let cursor = 58;
    return activeRegions.map((region) => {
      const regionNodes = nodes.filter((n) => n.region === region);
      const count = regionNodes.length;
      const dotR = dotRadiusFor(count);
      const minRadius = ((2 * dotR + 6) * count) / (2 * Math.PI);
      const radius = Math.max(cursor, minRadius);
      cursor = radius + dotR + 26;
      return { region, radius, dotR, nodes: regionNodes };
    });
  }, [activeRegions, nodes]);

  const outer = rings.length ? rings[rings.length - 1] : null;
  const size = Math.max(220, (outer ? outer.radius + outer.dotR : 60) * 2 + 44);
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div>
      {regionsPresent.length > 1 && (
        <div className="orbit-region-toggles">
          {regionsPresent.map((region) => (
            <label key={region} className="orbit-region-toggle">
              <input
                type="checkbox"
                checked={selected.has(region)}
                onChange={() => toggleRegion(region)}
              />
              {region}
            </label>
          ))}
        </div>
      )}

      {rings.length === 0 ? (
        <div className="empty-state" style={{ padding: "24px 0" }}>
          Pick a region above to see its neighbornets.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${size} ${size}`}
          style={{ width: "100%", height: "auto", display: "block", maxWidth: 420, margin: "0 auto" }}
        >
          {/* Faint ring boundaries — the "cell membrane" look, one per region. */}
          {rings.map((ring, ri) => (
            <circle
              key={`ring-${ring.region}`}
              className="orbit-animated"
              cx={cx}
              cy={cy}
              r={ring.radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1}
              style={{
                transformOrigin: `${cx}px ${cy}px`,
                animation: `orbit-membrane ${7 + (ri % 3)}s ease-in-out infinite`,
                animationDelay: `${ri * 0.6}s`,
              }}
            />
          ))}

          {rings.map((ring) =>
            ring.nodes.map((n, i) => {
              const angle = (i / ring.nodes.length) * Math.PI * 2 - Math.PI / 2 + 0.35;
              const x = cx + ring.radius * Math.cos(angle);
              const y = cy + ring.radius * Math.sin(angle);
              return (
                <line
                  key={`l-${n.id}`}
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth={1.2}
                  opacity={0.6}
                />
              );
            }),
          )}

          <circle
            className="orbit-animated"
            cx={cx}
            cy={cy}
            r={30}
            fill="var(--primary)"
            style={{
              filter: "drop-shadow(0 0 10px rgba(var(--primary-rgb), 0.7))",
              transformOrigin: `${cx}px ${cy}px`,
              animation: "orbit-pulse 5s ease-in-out infinite",
            }}
          />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fontFamily="var(--font-display), sans-serif"
            fontSize={11}
            fill="var(--on-primary)"
            fontWeight={600}
          >
            Cloud
          </text>

          {rings.map((ring) => {
            const labelAngle = -Math.PI / 2 - 0.02;
            return (
              <text
                key={`label-${ring.region}`}
                x={cx + ring.radius * Math.cos(labelAngle)}
                y={cy + ring.radius * Math.sin(labelAngle) - 8}
                textAnchor="middle"
                fontFamily="var(--font-body), sans-serif"
                fontSize={9}
                fontWeight={600}
                fill="var(--text-muted)"
                opacity={0.8}
              >
                {ring.region}
              </text>
            );
          })}

          {rings.map((ring) =>
            ring.nodes.map((n, i) => {
              const angle = (i / ring.nodes.length) * Math.PI * 2 - Math.PI / 2 + 0.35;
              const x = cx + ring.radius * Math.cos(angle);
              const y = cy + ring.radius * Math.sin(angle);
              const h = hashStr(n.id);
              const variant = DRIFT_VARIANTS[h % DRIFT_VARIANTS.length];
              const duration = 4 + (h % 30) / 10;
              const delay = (h % 25) / 10;
              return (
                <circle
                  key={`n-${n.id}`}
                  className="orbit-animated"
                  cx={x}
                  cy={y}
                  r={ring.dotR}
                  fill={ragColor(n.status)}
                  style={{
                    transformOrigin: `${x}px ${y}px`,
                    animation: `${variant} ${duration}s ease-in-out infinite`,
                    animationDelay: `${delay}s`,
                  }}
                >
                  <title>{n.name}</title>
                </circle>
              );
            }),
          )}
        </svg>
      )}
    </div>
  );
}
