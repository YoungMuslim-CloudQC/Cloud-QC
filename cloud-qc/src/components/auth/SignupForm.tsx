"use client";

import { useActionState } from "react";

import { signup, type SignupState } from "@/server/actions/auth";

const INITIAL: SignupState = { ok: false };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, INITIAL);

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
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
