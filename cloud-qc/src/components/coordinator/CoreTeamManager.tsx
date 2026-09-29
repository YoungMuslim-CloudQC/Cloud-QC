"use client";

import { useActionState, useState, useTransition } from "react";

import {
  inviteCoreTeamMember,
  removeCoreTeamMember,
  type CoreTeamState,
} from "@/server/actions/coordinator";

const INITIAL: CoreTeamState = {};

type Candidate = { id: string; name: string | null; email: string };

/** Two ways onto a core team, one control: pick someone who's already in
 *  Cloud QC, or type an email that isn't here yet. Both post the same
 *  email field, so the server decides which path it is rather than the
 *  client claiming one. */
export function CoreTeamManager(
  props:
    | { mode: "add"; candidates: Candidate[] }
    | { mode: "remove"; userId: string; name: string },
) {
  if (props.mode === "remove") return <RemoveButton {...props} />;
  return <AddForm candidates={props.candidates} />;
}

function RemoveButton({ userId, name }: { userId: string; name: string }) {
  const [pending, start] = useTransition();
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button
        type="button"
        className="btn btn-small btn-secondary"
        onClick={() => setArmed(true)}
      >
        Remove
      </button>
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span className="survey-time-note">Remove {name}?</span>
      <button
        type="button"
        className="btn btn-small btn-reject"
        disabled={pending}
        onClick={() => start(async () => void (await removeCoreTeamMember(userId)))}
      >
        {pending ? "…" : "Yes"}
      </button>
      <button
        type="button"
        className="btn btn-small btn-secondary"
        onClick={() => setArmed(false)}
      >
        No
      </button>
    </div>
  );
}

function AddForm({ candidates }: { candidates: Candidate[] }) {
  const [state, action, pending] = useActionState(inviteCoreTeamMember, INITIAL);
  const [email, setEmail] = useState("");

  return (
    <form action={action}>
      {state.error && <div className="auth-msg error">{state.error}</div>}
      {state.ok && state.notice && <div className="auth-msg info">{state.notice}</div>}

      {candidates.length > 0 && (
        <div className="field">
          <label htmlFor="ct-existing">Someone already in Cloud QC</label>
          <select
            id="ct-existing"
            value=""
            onChange={(e) => {
              const c = candidates.find((x) => x.id === e.target.value);
              if (c) setEmail(c.email);
            }}
          >
            <option value="">Pick a person…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || c.email}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="ct-email">Email</label>
        <input
          id="ct-email"
          name="email"
          type="email"
          required
          placeholder="name@youngmuslims.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="ct-name">
          Their name <span className="optional-tag">optional — for a new account</span>
        </label>
        <input id="ct-name" name="name" type="text" placeholder="e.g. Yusuf Ali" />
      </div>

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "auto" }}
        disabled={pending}
      >
        {pending ? "Adding…" : "Add to core team"}
      </button>
    </form>
  );
}
