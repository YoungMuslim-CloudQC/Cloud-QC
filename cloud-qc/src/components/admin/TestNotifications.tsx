"use client";

import { useState, useTransition } from "react";

import {
  sendTestDigest,
  sendTestSms,
  type TestResult,
} from "@/server/actions/test-notifications";

/** Admin-only "does this actually work" controls. The digest goes to the
 *  admin's own address with no recipient field at all; the text takes a
 *  number because a profile may not have one. */
export function TestNotifications({
  adminEmail,
  smsReady,
  missingSmsVars,
}: {
  adminEmail: string;
  smsReady: boolean;
  missingSmsVars: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<TestResult | null>(null);
  const [phone, setPhone] = useState("");
  // Which button is working, so only that one shows a spinner.
  const [busy, setBusy] = useState<string | null>(null);

  function run(key: string, fn: () => Promise<TestResult>) {
    setResult(null);
    setBusy(key);
    startTransition(async () => {
      try {
        setResult(await fn());
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div>
      <p className="survey-time-note" style={{ marginTop: 0 }}>
        Sends to you only, so you can see what everyone else gets. Test
        digests don&rsquo;t count as a real send — the one that&rsquo;s
        actually due still goes out on schedule.
      </p>

      <div className="test-notify-row">
        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={pending}
          onClick={() =>
            run("member", () => {
              const fd = new FormData();
              fd.set("variant", "member");
              return sendTestDigest(fd);
            })
          }
        >
          {busy === "member" ? "Sending…" : "Email me a member digest"}
        </button>

        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={pending}
          onClick={() =>
            run("coordinator", () => {
              const fd = new FormData();
              fd.set("variant", "coordinator");
              return sendTestDigest(fd);
            })
          }
        >
          {busy === "coordinator" ? "Sending…" : "Email me a coordinator digest"}
        </button>
      </div>
      <div className="survey-time-note" style={{ marginTop: 6 }}>
        Both go to {adminEmail}.
      </div>

      <div className="test-notify-sms">
        <label htmlFor="test-sms-phone" style={{ fontSize: 13, fontWeight: 600 }}>
          Send a test text
        </label>
        <div className="test-notify-row" style={{ marginTop: 6 }}>
          <input
            id="test-sms-phone"
            type="tel"
            inputMode="tel"
            placeholder="(201) 555-9876"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={{ maxWidth: 220 }}
          />
          <button
            type="button"
            className="btn btn-secondary btn-small"
            disabled={pending || !smsReady || phone.trim().length === 0}
            onClick={() =>
              run("sms", () => {
                const fd = new FormData();
                fd.set("phone", phone);
                return sendTestSms(fd);
              })
            }
          >
            {busy === "sms" ? "Sending…" : "Send test text"}
          </button>
        </div>
        <div className="survey-time-note" style={{ marginTop: 6 }}>
          {smsReady ? (
            <>
              Sends the opt-in confirmation wording. Use your own number — a
              test isn&rsquo;t consent and nothing is recorded as such.
            </>
          ) : (
            <>
              Twilio isn&rsquo;t configured yet. Still missing:{" "}
              <strong>{missingSmsVars.join(", ")}</strong>.
            </>
          )}
        </div>
      </div>

      {result && (
        <div
          className={`auth-msg ${result.ok ? "info" : "error"}`}
          style={{ marginTop: 12 }}
          role="status"
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
