"use client";

import { useActionState, useState, useTransition } from "react";

import {
  inviteCoreTeamMember,
  removeCoreTeamMember,
  type CoreTeamState,
} from "@/server/actions/coordinator";

const INITIAL: CoreTeamState = {};

/** Invite by email, and only by email. There's deliberately no roster to
 *  pick from: browsing the Cloud QC team and seating one of them would make
 *  that person's account view-only and stop them logging visits. People can
 *  hold both roles, but an admin sets that up — it isn't something to land
 *  on someone from here. */
export function CoreTeamManager(
  props: { mode: "add" } | { mode: "remove"; userId: string; name: string },
) {
  if (props.mode === "remove") return <RemoveButton {...props} />;
  return <AddForm />;
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

function AddForm() {
  const [state, action, pending] = useActionState(inviteCoreTeamMember, INITIAL);

  return (
    <form action={action}>
      {state.error && <div className="auth-msg error">{state.error}</div>}
      {state.ok && state.notice && <div className="auth-msg info">{state.notice}</div>}

      <div className="field">
        <label htmlFor="ct-email">Their email</label>
        <input
          id="ct-email"
          name="email"
          type="email"
          required
          placeholder="name@youngmuslims.com"
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
