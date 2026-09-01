"use client";

import { useState } from "react";

import { NetworkMap, type MapNeighbornet } from "@/components/NetworkMap";
import { CountryMap, type StateStat } from "@/components/CountryMap";

export function MapViewSwitcher({
  neighbornets,
  stateStats,
}: {
  neighbornets: MapNeighbornet[];
  stateStats: Record<string, StateStat>;
}) {
  const [view, setView] = useState<"country" | "state">("country");
  const [preselected, setPreselected] = useState("");

  return (
    <>
      <div
        className="view-toggle"
        style={{ marginBottom: 16, display: "inline-flex" }}
      >
        <button
          type="button"
          className={`view-toggle-btn${view === "country" ? " active" : ""}`}
          onClick={() => setView("country")}
        >
          Country
        </button>
        <button
          type="button"
          className={`view-toggle-btn${view === "state" ? " active" : ""}`}
          onClick={() => setView("state")}
        >
          State
        </button>
      </div>

      {view === "country" ? (
        <CountryMap
          stateStats={stateStats}
          onDrill={(code) => {
            setPreselected(code);
            setView("state");
          }}
        />
      ) : (
        <NetworkMap
          key={preselected || "state"}
          neighbornets={neighbornets}
          initialState={preselected}
        />
      )}
    </>
  );
}
