"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  EMPTY_VISIT_INPUT,
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

type Option = { id: string; label: string };

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
  members,
  submitterName,
  editing,
}: {
  neighbornets: Option[];
  members: Option[];
  submitterName: string;
  editing?: { visitId: string; input: VisitInput } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const initial: VisitInput = editing
    ? editing.input
    : {
        ...EMPTY_VISIT_INPUT,
        neighbornetIds: neighbornets[0] ? [neighbornets[0].id] : [],
        visitDate: todayIso(),
      };

  const [form, setForm] = useState<VisitInput>(initial);
  const [coPick, setCoPick] = useState("");
  const [nnPick, setNnPick] = useState("");
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

  function addNeighbornet() {
    if (!nnPick) return;
    if (!form.neighbornetIds.includes(nnPick)) {
      set("neighbornetIds", [...form.neighbornetIds, nnPick]);
    }
    setNnPick("");
  }

  function removeNeighbornet(id: string) {
    if (form.neighbornetIds.length <= 1) return;
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
          neighbornetIds: neighbornets[0] ? [neighbornets[0].id] : [],
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

          {editing ? (
            <div className="field full">
              <label>Neighbornet</label>
              <select
                value={form.neighbornetIds[0] ?? ""}
                onChange={(e) => set("neighbornetIds", [e.target.value])}
                required
              >
                {neighbornets.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field full">
              <label>
                Neighbornet(s){" "}
                <span className="optional-tag">
                  add more than one if this was a joint event
                </span>
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={nnPick}
                  onChange={(e) => setNnPick(e.target.value)}
                >
                  <option value="">Add another neighbornet…</option>
                  {neighbornets
                    .filter((n) => !form.neighbornetIds.includes(n.id))
                    .map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.label}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  style={{ flexShrink: 0 }}
                  onClick={addNeighbornet}
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
                {form.neighbornetIds.map((id) => (
                  <span className="chip" key={id}>
                    {neighbornetById.get(id) ?? "Unknown"}
                    {form.neighbornetIds.length > 1 && (
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
              </div>
            </div>
          )}

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
