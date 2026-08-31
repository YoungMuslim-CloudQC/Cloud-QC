"use client";

import { useActionState } from "react";

import {
  saveDashboardAdjustments,
  type SettingsState,
} from "@/server/actions/settings";

const INITIAL: SettingsState = {};

export function DashboardAdjustments({
  manualOffset,
  goal,
}: {
  manualOffset: number;
  goal: number | null;
}) {
  const [state, formAction, pending] = useActionState(
    saveDashboardAdjustments,
    INITIAL,
  );

  return (
    <form action={formAction}>
      {state.error && <div className="auth-msg error">{state.error}</div>}
      {state.ok && <div className="auth-msg info">Saved.</div>}
      <div className="form-grid">
        <div className="field">
          <label htmlFor="manualOffset">Manual visit adjustment</label>
          <input
            id="manualOffset"
            name="manualOffset"
            type="number"
            defaultValue={manualOffset}
          />
        </div>
        <div className="field">
          <label htmlFor="goal">
            Visit goal <span className="optional-tag">optional</span>
          </label>
          <input
            id="goal"
            name="goal"
            type="number"
            min={0}
            defaultValue={goal ?? ""}
            placeholder="e.g. 100"
          />
        </div>
      </div>
      <button
        className="btn btn-primary"
        type="submit"
        style={{ width: "auto" }}
        disabled={pending}
      >
        {pending ? "Saving…" : "Save"}
      </button>
      <div
        style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 8 }}
      >
        The manual adjustment is added directly to &ldquo;Visits logged&rdquo;
        on the dashboard — use it for visits logged outside the app.
      </div>
    </form>
  );
}
