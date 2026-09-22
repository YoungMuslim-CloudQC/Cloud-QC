"use client";

import { useActionState, useState } from "react";

import { signup, type SignupState } from "@/server/actions/auth";
import type { RegionMap } from "@/lib/queries";
import {
  NeighbornetPicker,
  type PickableNeighbornet,
} from "@/components/NeighbornetPicker";

const INITIAL: SignupState = { ok: false };

export function SignupForm({
  neighbornets,
  regionMap,
}: {
  neighbornets: PickableNeighbornet[];
  regionMap: RegionMap;
}) {
  const [state, formAction, pending] = useActionState(signup, INITIAL);
  const [role, setRole] = useState<"MEMBER" | "COORDINATOR">("MEMBER");
  const [nnIds, setNnIds] = useState<string[]>([]);

  if (state.ok) {
    return (
      <div className="auth-msg info">
        Account created. An admin needs to approve you before you can log in.
      </div>
    );
  }

  return (
    <form action={formAction}>
      {state.error && <div className="auth-msg error">{state.error}</div>}
      <div className="field">
        <label htmlFor="signup-name">Full name</label>
        <input id="signup-name" name="name" type="text" autoComplete="name" required />
        {state.fieldErrors?.name && (
          <span className="field-error">{state.fieldErrors.name}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="signup-email">Email</label>
        <input
          id="signup-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
        {state.fieldErrors?.email && (
          <span className="field-error">{state.fieldErrors.email}</span>
        )}
      </div>
      <div className="field">
        <label htmlFor="signup-password">Choose a password</label>
        <input
          id="signup-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        {state.fieldErrors?.password && (
          <span className="field-error">{state.fieldErrors.password}</span>
        )}
      </div>
      <div className="field">
        <label>I am a…</label>
        <div className="status-options">
          <label className={`status-opt${role === "MEMBER" ? " sel-ok" : ""}`} style={{ cursor: "pointer" }}>
            <input
              type="radio"
              name="role"
              value="MEMBER"
              checked={role === "MEMBER"}
              onChange={() => setRole("MEMBER")}
              style={{ display: "none" }}
            />
            QC member
          </label>
          <label className={`status-opt${role === "COORDINATOR" ? " sel-ok" : ""}`} style={{ cursor: "pointer" }}>
            <input
              type="radio"
              name="role"
              value="COORDINATOR"
              checked={role === "COORDINATOR"}
              onChange={() => setRole("COORDINATOR")}
              style={{ display: "none" }}
            />
            Neighbornet coordinator
          </label>
        </div>
        <div className="survey-time-note" style={{ marginTop: 6 }}>
          {role === "COORDINATOR"
            ? "Coordinators receive the QC feedback about their neighbornet."
            : "QC members log visits and feedback."}
        </div>
      </div>
      {role === "COORDINATOR" && (
        <div className="field">
          <label>Which neighbornet do you coordinate?</label>
          <NeighbornetPicker
            neighbornets={neighbornets}
            regionMap={regionMap}
            selectedIds={nnIds}
            onChange={setNnIds}
            emptyHint="Pick a sub-region, then your neighbornet."
          />
          {nnIds.map((id) => (
            <input key={id} type="hidden" name="neighbornetIds" value={id} />
          ))}
          {state.fieldErrors?.neighbornetIds && (
            <span className="field-error">{state.fieldErrors.neighbornetIds}</span>
          )}
        </div>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
