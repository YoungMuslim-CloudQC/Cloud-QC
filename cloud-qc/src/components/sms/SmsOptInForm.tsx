"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { formatE164 } from "@/lib/phone";
import {
  SMS_AGREEMENT_LINE,
  SMS_BRAND,
  SMS_CONSENT_TEXT,
  SMS_FREQUENCY_LINE,
  SMS_HELP_STOP_LINE,
  SMS_MESSAGE_TYPES,
  SMS_NO_MARKETING_LINE,
  SMS_RATES_LINE,
} from "@/lib/sms-consent-copy";
import { submitSmsOptIn } from "@/server/actions/sms-opt-in";

export function SmsOptInForm({
  token = "",
  willLink = true,
}: {
  token?: string;
  /** False when nothing identifies the visitor, so the opt-in would not
   *  attach to any account. */
  willLink?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  // Tracked only to drive the button's disabled state. The value that counts
  // is the one the server reads off the submitted form.
  const [consent, setConsent] = useState(false);

  /**
   * Handled through onSubmit rather than the form's `action` prop on
   * purpose. React resets the form once an action resolves, which unticks
   * the consent box while `consent` state stays true — so after one failed
   * submit the button looks ready, the box looks empty, and the retry sends
   * no consent at all. On a form whose entire job is recording consent
   * accurately, that desync is the worst possible bug.
   */
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await submitSmsOptIn(formData);
      if (res.ok) setDone(res.phone);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="optin-card optin-done">
        <div className="optin-check" aria-hidden="true">
          ✓
        </div>
        <h2 className="optin-done-title">You&rsquo;re signed up</h2>
        <p className="optin-done-sub">
          {formatE164(done)} will receive text messages from {SMS_BRAND}.
        </p>
        <p className="optin-done-note">
          Reply <strong>STOP</strong> to any message to cancel, or{" "}
          <strong>HELP</strong> for help. You can also change this any time in
          your Cloud QC profile.
        </p>
      </div>
    );
  }

  return (
    <form className="optin-card" onSubmit={onSubmit} noValidate>
      <h1 className="optin-title">{SMS_BRAND} Text Alerts</h1>
      <p className="optin-intro">
        Get your neighbornet&rsquo;s QC updates by text instead of digging
        through email.
      </p>

      <input type="hidden" name="t" value={token} />

      {!willLink && (
        <div className="optin-signin-note">
          <strong>Already have a Cloud QC account?</strong>{" "}
          <a href="/login?callbackUrl=%2Fsms-opt-in">Sign in first</a> so these
          texts are tied to your account. Signing up here without it records
          your number, but we won&rsquo;t know whose updates to send you.
        </div>
      )}

      <label className="optin-label" htmlFor="phone">
        Mobile Phone Number<span aria-hidden="true">*</span>
      </label>
      <input
        id="phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        required
        placeholder="(201) 555-9876"
        className="optin-input"
        aria-describedby="phone-help"
      />
      <div id="phone-help" className="optin-help">
        US and Canadian mobile numbers only.
      </div>

      {/*
        Not pre-checked, and deliberately has no defaultChecked prop at all —
        a pre-ticked consent box invalidates the consent and is an automatic
        carrier rejection.
      */}
      <label className="optin-consent">
        <input
          type="checkbox"
          name="consent"
          value="on"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="optin-checkbox"
        />
        <span>{SMS_CONSENT_TEXT}</span>
      </label>

      <div className="optin-section">
        <h2 className="optin-section-title">What you&rsquo;ll receive</h2>
        <ul className="optin-types">
          {SMS_MESSAGE_TYPES.map((t) => (
            <li key={t.title}>
              <strong>{t.title}:</strong> {t.body}
            </li>
          ))}
        </ul>
      </div>

      <dl className="optin-terms">
        <dt>Message Frequency:</dt>
        <dd>{SMS_FREQUENCY_LINE}</dd>
        <dt>Standard Rates:</dt>
        <dd>{SMS_RATES_LINE}</dd>
        <dt>Help &amp; Stop:</dt>
        <dd>{SMS_HELP_STOP_LINE}</dd>
      </dl>

      <p className="optin-agree">{SMS_AGREEMENT_LINE}</p>
      <p className="optin-agree">{SMS_NO_MARKETING_LINE}</p>

      <p className="optin-legal">
        <Link href="/terms">Terms of Service</Link>
        {" | "}
        <Link href="/privacy">Privacy Policy</Link>
      </p>

      {error && (
        <div className="optin-error" role="alert">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="optin-submit"
        disabled={pending || !consent}
      >
        {pending ? "Signing you up…" : "Yes, sign me up!"}
      </button>
    </form>
  );
}
