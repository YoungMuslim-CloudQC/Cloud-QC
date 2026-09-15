"use client";

import { useActionState } from "react";

import { sendTestDigestToSelf, type TestDigestState } from "@/server/actions/digest";

const INITIAL: TestDigestState = {};

/** Its own <form> — kept out of ProfileForm's form since HTML doesn't allow
 *  nesting forms. */
export function SendTestDigestButton() {
  const [state, formAction, pending] = useActionState(sendTestDigestToSelf, INITIAL);

  return (
    <form action={formAction} className="subpanel" style={{ marginTop: 20 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
        Test the digest <span className="tag-construction">Admin</span>
      </div>
      <div className="survey-time-note" style={{ marginBottom: 10 }}>
        Sends a one-off copy of what your digest looks like to your own email
        right now — doesn&rsquo;t affect your real schedule. Regular members
        don&rsquo;t see this: they get an immediate digest the moment they
        turn on a cadence instead.
      </div>
      {state.error && <div className="auth-msg error">{state.error}</div>}
      {state.ok && <div className="auth-msg info">Sent — check your inbox.</div>}
      <button className="btn btn-secondary btn-small" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send me a test digest"}
      </button>
    </form>
  );
}
