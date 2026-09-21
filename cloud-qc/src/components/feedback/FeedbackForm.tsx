"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  EMPTY_VISIT_INPUT,
  EVENT_TYPES,
  EVENT_TYPE_LABEL,
  VISIT_STATUSES,
  type DuplicateInfo,
  type VisitInput,
  type VisitStatusValue,
} from "@/lib/visit-schema";
import {
  resolveJointDuplicates,
  submitFeedback,
  updateFeedback,
} from "@/server/actions/visits";
import type { RegionMap } from "@/lib/queries";
import { SubRegionSelect } from "@/components/SubRegionSelect";
import { AREA_ALL, matchesArea, parseArea, subValue } from "@/lib/sub-regions";

type Option = { id: string; label: string };
type NnOption = {
  id: string;
  name: string;
  subArea: string | null;
  region: string;
  label: string;
};

const EVENT_TYPE_HINT: Record<(typeof EVENT_TYPES)[number], string> = {
  VISIT: "A normal visit to one or more neighbornets.",
  BASH: "A bash — sub-regions coming together.",
  SR_EVENT: "An SR event — an inter-sub-region gathering.",
};

const STATUS_UI: Record<VisitStatusValue, { label: string; cls: string }> = {
  ON_TRACK: { label: "On track", cls: "sel-ok" },
  NEEDS_FOLLOWUP: { label: "Needs follow-up", cls: "sel-warn" },
  URGENT: { label: "Urgent", cls: "sel-urgent" },
};

const RATING_FIELDS = [
  ["foodRating", "How was the food?"],
  ["leadershipRating", "How was the leadership?"],
  ["halaqahRating", "How was the halaqah?"],
] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function FeedbackForm({
  neighbornets,
  regionMap,
  homeSubArea,
  members,
  submitterName,
  editing,
}: {
  neighbornets: NnOption[];
  regionMap: RegionMap;
  /** The submitter's profile home — the sub-region the picker starts on. */
  homeSubArea: string | null;
  members: Option[];
  submitterName: string;
  editing?: { visitId: string; input: VisitInput } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // No neighbornet is pre-picked: the sub-region filter narrows the list
  // first, and defaulting to "the first in the catalog" invited mis-logs.
  const initial: VisitInput = editing
    ? editing.input
    : { ...EMPTY_VISIT_INPUT, visitDate: todayIso() };

  const [form, setForm] = useState<VisitInput>(initial);
  const [coPick, setCoPick] = useState("");
  const [area, setArea] = useState<string>(() => {
    if (editing) {
      const nn = neighbornets.find((n) => n.id === editing.input.neighbornetIds[0]);
      return nn?.subArea ? subValue(nn.subArea) : AREA_ALL;
    }
    return homeSubArea ? subValue(homeSubArea) : AREA_ALL;
  });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m.label])),
    [members],
  );
  const neighbornetById = useMemo(
    () => new Map(neighbornets.map((n) => [n.id, n.label])),
    [neighbornets],
  );

  const progress = useMemo(() => {
    const tracked = [
      form.groupSize != null,
      form.avgAge != null,
      form.foodRating != null,
      form.leadershipRating != null,
      form.halaqahRating != null,
      form.status != null,
      form.coVisitorIds.length > 0,
      form.notes.trim().length > 0,
    ];
    return Math.round((tracked.filter(Boolean).length / tracked.length) * 100);
  }, [form]);

  function set<K extends keyof VisitInput>(key: K, value: VisitInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addCoVisitor() {
    if (!coPick) return;
    if (!form.coVisitorIds.includes(coPick)) {
      set("coVisitorIds", [...form.coVisitorIds, coPick]);
    }
    setCoPick("");
  }

  // In the picker: matches the chosen sub-region, and (when logging several
  // at once) isn't already picked.
  const pickable = neighbornets.filter(
    (n) =>
      matchesArea(n, area) && (editing || !form.neighbornetIds.includes(n.id)),
  );

  function pickNeighbornet(id: string) {
    if (!id) return;
    if (editing) {
      set("neighbornetIds", [id]);
    } else if (!form.neighbornetIds.includes(id)) {
      set("neighbornetIds", [...form.neighbornetIds, id]);
    }
  }

  // For bashes / SR events: pull in everything in the chosen sub-region.
  function addAllInArea() {
    const ids = pickable.map((n) => n.id);
    set("neighbornetIds", [...form.neighbornetIds, ...ids]);
  }

  function removeNeighbornet(id: string) {
    set(
      "neighbornetIds",
      form.neighbornetIds.filter((x) => x !== id),
    );
  }

  function handleResult(
    res: Awaited<ReturnType<typeof submitFeedback>>,
    successMsg: string,
  ) {
    if (res.ok) {
      setDuplicates([]);
      setError(null);
      if (editing) {
        setNotice("Submission updated.");
        router.push("/feedback");
      } else {
        setForm({
          ...EMPTY_VISIT_INPUT,
          visitDate: todayIso(),
        });
        setNotice(successMsg);
      }
      router.refresh();
      return;
    }
    if ("duplicates" in res) {
      setDuplicates(res.duplicates);
      return;
    }
    setError(res.error);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setDuplicates([]);
    if (form.neighbornetIds.length === 0) {
      setError("Pick at least one neighbornet.");
      return;
    }
    if (!form.notes.trim()) {
      setError("The feedback paragraph is required to submit.");
      return;
    }
    startTransition(async () => {
      const res = editing
        ? await updateFeedback(editing.visitId, form)
        : await submitFeedback(form);
      handleResult(res, "Feedback submitted.");
    });
  }

  function resolveDuplicate(mode: "link" | "separate") {
    if (!duplicates.length) return;
    startTransition(async () => {
      const res = await resolveJointDuplicates(form, duplicates, mode);
      handleResult(
        res,
        mode === "link" ? "Linked to the existing visit(s)." : "Feedback submitted.",
      );
    });
  }

  if (neighbornets.length === 0) {
    return (
      <div className="card" style={{ maxWidth: 640 }}>
        <div className="empty-state">
          <strong>Add a neighbornet first</strong>
          There is nothing to submit feedback for yet.
        </div>
      </div>
    );
  }

  return (
    <>
      {editing && (
        <div className="editing-banner">
          <span>Editing your submission</span>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => router.push("/feedback")}
          >
            Cancel edit
          </button>
        </div>
      )}

      <div className="survey-progress-wrap">
        <div className="progress-top">
          <span>Your progress</span>
          <span>{progress}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="survey-time-note">
          Takes about 5 minutes. Only the feedback paragraph at the bottom is
          required — everything else is a bonus.
        </div>
      </div>

      {duplicates.length > 0 && (
        <div className="duplicate-banner">
          <div className="dup-title">
            {duplicates.length > 1
              ? "Visits already exist for this date"
              : "A visit already exists for this date"}
          </div>
          <div className="dup-desc">
            {duplicates.map((d) => (
              <div key={d.neighbornetId}>
                {d.submittedByName} already logged a visit to{" "}
                {d.neighbornetName} on {d.visitDate}.
              </div>
            ))}
            Link yours to the existing one(s) instead of counting separate
            visits? Any other neighbornet you picked still gets logged fresh.
          </div>
          <div className="dup-actions">
            <button
              type="button"
              className="btn btn-primary btn-small"
              style={{ width: "auto" }}
              disabled={pending}
              onClick={() => resolveDuplicate("link")}
            >
              Link my visit
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              disabled={pending}
              onClick={() => resolveDuplicate("separate")}
            >
              Submit as separate visit
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ maxWidth: 640 }}>
        {error && <div className="auth-msg error">{error}</div>}
        {notice && <div className="auth-msg info">{notice}</div>}

        <form onSubmit={onSubmit}>
          <div className="field full">
            <label>Submitting as</label>
            <div
              style={{
                padding: "9px 11px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                fontWeight: 600,
              }}
            >
              {submitterName}
            </div>
          </div>

          <div className="field full">
            <label>What are you logging?</label>
            <div className="status-options">
              {EVENT_TYPES.map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`status-opt${
                    form.eventType === t ? " sel-ok" : ""
                  }`}
                  onClick={() => set("eventType", t)}
                >
                  {EVENT_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <div className="survey-time-note" style={{ marginTop: 6 }}>
              {EVENT_TYPE_HINT[form.eventType]}
            </div>
          </div>

          <div className="field full">
            <label>
              {editing ? "Neighbornet" : "Neighbornet(s)"}{" "}
              {!editing && (
                <span className="optional-tag">
                  pick more than one if it was a joint event
                </span>
              )}
            </label>
            <div className="nn-picker-row">
              <SubRegionSelect
                regionMap={regionMap}
                value={area}
                onChange={setArea}
                emptyLabel="All sub-regions"
                allowWholeState
              />
              <select
                value=""
                onChange={(e) => pickNeighbornet(e.target.value)}
              >
                <option value="">
                  {pickable.length === 0
                    ? "No neighbornets here"
                    : editing
                      ? "Choose a neighbornet…"
                      : "Add a neighbornet…"}
                </option>
                {pickable.map((n) => (
                  <option key={n.id} value={n.id}>
                    {parseArea(area).kind === "sub" ? n.name : n.label}
                  </option>
                ))}
              </select>
            </div>
            {!editing && parseArea(area).kind !== "all" && pickable.length > 1 && (
              <button
                type="button"
                className="btn btn-secondary btn-small nn-add-all"
                onClick={addAllInArea}
              >
                Add all {pickable.length} in this sub-region
              </button>
            )}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {form.neighbornetIds.map((id) => (
                <span className="chip" key={id}>
                  {neighbornetById.get(id) ?? "Unknown"}
                  {!editing && (
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => removeNeighbornet(id)}
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {form.neighbornetIds.length === 0 && (
                <span className="survey-time-note">
                  Pick a sub-region, then the neighbornet.
                </span>
              )}
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Visit date</label>
              <input
                type="date"
                value={form.visitDate}
                onChange={(e) => set("visitDate", e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>
                Average group size <span className="optional-tag">optional</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.groupSize ?? ""}
                onChange={(e) =>
                  set(
                    "groupSize",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="e.g. 24"
              />
            </div>
            <div className="field">
              <label>
                Average age <span className="optional-tag">optional</span>
              </label>
              <input
                type="number"
                min={0}
                value={form.avgAge ?? ""}
                onChange={(e) =>
                  set(
                    "avgAge",
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
                placeholder="e.g. 15"
              />
            </div>
          </div>

          <div className="field full">
            <label>
              Anyone else from Cloud who visited with you?{" "}
              <span className="optional-tag">
                optional — counts as their visit too
              </span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={coPick}
                onChange={(e) => setCoPick(e.target.value)}
              >
                <option value="">Select a member…</option>
                {members
                  .filter((m) => !form.coVisitorIds.includes(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                style={{ flexShrink: 0 }}
                onClick={addCoVisitor}
              >
                Add
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {form.coVisitorIds.map((id) => (
                <span className="chip" key={id}>
                  {memberById.get(id) ?? "Unknown"}
                  <button
                    type="button"
                    className="chip-remove"
                    onClick={() =>
                      set(
                        "coVisitorIds",
                        form.coVisitorIds.filter((x) => x !== id),
                      )
                    }
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {RATING_FIELDS.map(([key, label]) => (
            <div className="field full" key={key}>
              <label>
                {label} <span className="optional-tag">optional</span>
              </label>
              <div className="rating-row">
                <div className="rating-stars">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <button
                      type="button"
                      key={i}
                      className={`star${(form[key] ?? 0) >= i ? " on" : ""}`}
                      onClick={() =>
                        set(key, form[key] === i ? null : (i as 1 | 2 | 3 | 4 | 5))
                      }
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="field full">
            <label>
              Overall status <span className="optional-tag">optional</span>
            </label>
            <div className="status-options">
              {VISIT_STATUSES.map((s) => (
                <button
                  type="button"
                  key={s}
                  className={`status-opt${
                    form.status === s ? ` ${STATUS_UI[s].cls}` : ""
                  }`}
                  onClick={() => set("status", form.status === s ? null : s)}
                >
                  {STATUS_UI[s].label}
                </button>
              ))}
            </div>
          </div>

          <div className="field full">
            <label>
              Feedback paragraph{" "}
              <span
                className="optional-tag"
                style={{ color: "var(--secondary)" }}
              >
                required
              </span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="What did you observe? This is the only field that must be filled in to submit."
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "auto" }}
            disabled={pending}
          >
            {pending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Submit feedback"}
          </button>
        </form>
      </div>
    </>
  );
}
