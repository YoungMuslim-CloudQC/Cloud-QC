"use client";

import { useEffect, useRef, useState } from "react";

import type { RegionMap } from "@/lib/queries";

/**
 * Closed-by-default multi-select for the three split states (NJ/NY/TX).
 * Checking a split state's own checkbox selects all of its sub-areas and
 * expands it so the pick is visible; the +/− toggle expands or collapses
 * independently of selection, so a user can instead go straight to picking
 * individual sub-areas without ever selecting-then-deselecting (the Excel
 * filter pattern this is modeled on). Flat states are just one checkbox.
 */
export function AreaMultiSelect({
  regionMap,
  selected,
  onToggle,
  onSetMany,
  fieldName,
}: {
  regionMap: RegionMap;
  selected: Set<string>;
  onToggle: (value: string) => void;
  onSetMany: (values: string[], checked: boolean) => void;
  fieldName: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggleExpanded(region: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  function toggleParent(region: string, subAreas: string[]) {
    const allChecked = subAreas.every((a) => selected.has(a));
    onSetMany(subAreas, !allChecked);
    if (!allChecked) {
      setExpanded((prev) => new Set(prev).add(region));
    }
  }

  const summary =
    selected.size === 0
      ? "Select areas…"
      : selected.size <= 3
        ? [...selected].join(", ")
        : `${selected.size} areas selected`;

  return (
    <div className="area-dropdown" ref={rootRef}>
      <button
        type="button"
        className="area-dropdown-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className={selected.size === 0 ? "area-dropdown-placeholder" : ""}>
          {summary}
        </span>
        <span className="area-dropdown-caret">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="area-dropdown-panel">
          {regionMap.map((r) => {
            const isSplit = r.subAreas.length > 1;
            if (!isSplit) {
              const value = r.subAreas[0] ?? r.region;
              return (
                <label key={r.region} className="area-dropdown-row">
                  <input
                    type="checkbox"
                    checked={selected.has(value)}
                    onChange={() => onToggle(value)}
                  />
                  {r.region}
                </label>
              );
            }

            const allChecked = r.subAreas.every((a) => selected.has(a));
            const someChecked = r.subAreas.some((a) => selected.has(a));
            const isExpanded = expanded.has(r.region);

            return (
              <div key={r.region}>
                <div className="area-dropdown-row area-dropdown-parent">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = !allChecked && someChecked;
                    }}
                    onChange={() => toggleParent(r.region, r.subAreas)}
                  />
                  <span
                    className="area-dropdown-label"
                    onClick={() => toggleParent(r.region, r.subAreas)}
                  >
                    {r.region}
                  </span>
                  <button
                    type="button"
                    className="area-dropdown-chevron"
                    onClick={() => toggleExpanded(r.region)}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? "−" : "+"}
                  </button>
                </div>
                {isExpanded && (
                  <div className="area-dropdown-children">
                    {r.subAreas.map((a) => (
                      <label key={a} className="area-dropdown-row area-dropdown-child">
                        <input
                          type="checkbox"
                          checked={selected.has(a)}
                          onChange={() => onToggle(a)}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {[...selected].map((v) => (
        <input key={v} type="hidden" name={fieldName} value={v} />
      ))}
    </div>
  );
}
