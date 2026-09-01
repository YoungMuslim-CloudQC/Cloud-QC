"use client";

import { geoMercator, geoPath } from "d3-geo";
import { useEffect, useState } from "react";
import type { Topology } from "topojson-specification";

import { STATE_NAMES, STATE_CODES, loadStatesTopo, stateFeature } from "@/lib/us-map";

const W = 640;
const H = 520;

type Point = { lat: number; lng: number };

export function LocationPicker({
  existingStates,
  initial,
}: {
  /** Codes already in use — only used to pick a sensible default. */
  existingStates: string[];
  initial?: {
    stateCode: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}) {
  const [selected, setSelected] = useState<string>(
    initial?.stateCode?.toUpperCase() ??
      existingStates[0]?.toUpperCase() ??
      "",
  );
  const [topo, setTopo] = useState<Topology | null>(null);
  const [topoError, setTopoError] = useState(false);

  // Which state the current marker belongs to — so switching states clears it.
  const initialPoint: Point | null =
    initial?.latitude != null && initial?.longitude != null
      ? { lat: initial.latitude, lng: initial.longitude }
      : null;
  const [point, setPoint] = useState<{ code: string; at: Point } | null>(
    initialPoint && initial?.stateCode
      ? { code: initial.stateCode.toUpperCase(), at: initialPoint }
      : null,
  );

  useEffect(() => {
    let cancelled = false;
    loadStatesTopo()
      .then((t) => !cancelled && setTopo(t))
      .catch(() => !cancelled && setTopoError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const code = selected;
  const stateName = STATE_NAMES[code];

  let pathD: string | null = null;
  let projection: ReturnType<typeof geoMercator> | null = null;
  if (topo && stateName) {
    const feat = stateFeature(topo, code);
    if (feat) {
      projection = geoMercator().fitExtent(
        [
          [20, 20],
          [W - 20, H - 20],
        ],
        feat,
      );
      pathD = geoPath(projection)(feat);
    }
  }

  const activePoint = point && point.code === code ? point.at : null;
  const marker =
    activePoint && projection
      ? projection([activePoint.lng, activePoint.lat])
      : null;

  function handleMapClick(e: React.MouseEvent<SVGSVGElement>) {
    if (!projection?.invert) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const inv = projection.invert([x, y]);
    if (!inv) return;
    setPoint({
      code,
      at: {
        lng: Number(inv[0].toFixed(6)),
        lat: Number(inv[1].toFixed(6)),
      },
    });
  }

  return (
    <div className="field full">
      <label>
        Location <span className="optional-tag">click the map to place a pin</span>
      </label>

      <div style={{ marginBottom: 8 }}>
        <select
          name="stateCode"
          required
          value={selected}
          style={{ maxWidth: 260 }}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="" disabled>
            Select a state…
          </option>
          {STATE_CODES.map((c) => (
            <option key={c} value={c}>
              {STATE_NAMES[c]} ({c})
            </option>
          ))}
        </select>
      </div>

      <div className="geo-map-card" style={{ padding: 12 }}>
        {topoError ? (
          <div className="geo-empty">Could not load the map. Refresh to retry.</div>
        ) : !code ? (
          <div className="geo-empty">Pick a state to start.</div>
        ) : !topo ? (
          <div className="geo-empty">Loading map…</div>
        ) : !stateName ? (
          <div className="geo-empty">
            &ldquo;{code}&rdquo; isn&apos;t a valid state code.
          </div>
        ) : !pathD ? (
          <div className="geo-empty">Couldn&apos;t draw {stateName}.</div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
            onClick={handleMapClick}
          >
            <path
              d={pathD}
              fill="rgba(139,92,246,0.10)"
              stroke="#8B5CF6"
              strokeWidth={2}
            />
            {marker && (
              <>
                <circle cx={marker[0]} cy={marker[1]} r={9} fill="#38BDF8" opacity={0.25} />
                <circle
                  cx={marker[0]}
                  cy={marker[1]}
                  r={5}
                  fill="#38BDF8"
                  stroke="#170F32"
                  strokeWidth={1.5}
                />
              </>
            )}
          </svg>
        )}
      </div>

      <div
        style={{
          fontSize: 12,
          color: "var(--text-muted)",
          marginTop: 6,
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {activePoint ? (
          <>
            <span className="cell-mono">
              {activePoint.lat}, {activePoint.lng}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => setPoint(null)}
            >
              Clear pin
            </button>
          </>
        ) : (
          <span>No location set — click the map to place a pin.</span>
        )}
      </div>

      <input
        type="hidden"
        name="latitude"
        value={activePoint ? activePoint.lat : ""}
      />
      <input
        type="hidden"
        name="longitude"
        value={activePoint ? activePoint.lng : ""}
      />
    </div>
  );
}
