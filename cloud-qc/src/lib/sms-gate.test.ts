import { describe, expect, it } from "vitest";

import { toE164 } from "@/lib/phone";

/**
 * The refusal rules in sendToUser, restated as data.
 *
 * sendToUser itself reaches the database and Twilio, so it isn't unit
 * testable without standing both up. What is worth pinning is the decision
 * table — these are the conditions under which a message must not go out,
 * and getting any of them backwards sends a text to someone who didn't
 * agree to one. Mirrors the order of the checks in sms-send.ts.
 */
type Candidate = {
  status: string;
  smsConsent: boolean;
  notificationChannel: string;
  phone: string | null;
  lastEvent?: "GRANTED" | "REVOKED";
};

function wouldSend(u: Candidate): { send: boolean; reason?: string } {
  if (u.status !== "APPROVED") return { send: false, reason: "account not approved" };
  if (!u.smsConsent) return { send: false, reason: "no SMS consent" };
  if (u.notificationChannel === "EMAIL") return { send: false, reason: "channel is email only" };
  if (!u.phone) return { send: false, reason: "no phone number" };
  if (!toE164(u.phone)) return { send: false, reason: "unusable phone number" };
  if (u.lastEvent === "REVOKED") return { send: false, reason: "opted out (STOP)" };
  return { send: true };
}

const ok: Candidate = {
  status: "APPROVED",
  smsConsent: true,
  notificationChannel: "SMS",
  phone: "201-555-9876",
  lastEvent: "GRANTED",
};

describe("who may be texted", () => {
  it("sends to an approved, consenting member who picked SMS", () => {
    expect(wouldSend(ok).send).toBe(true);
    expect(wouldSend({ ...ok, notificationChannel: "BOTH" }).send).toBe(true);
  });

  it("refuses without consent, whatever the channel says", () => {
    expect(wouldSend({ ...ok, smsConsent: false })).toEqual({
      send: false,
      reason: "no SMS consent",
    });
  });

  it("refuses when they chose email only", () => {
    expect(wouldSend({ ...ok, notificationChannel: "EMAIL" }).send).toBe(false);
  });

  it("refuses an account that isn't approved", () => {
    expect(wouldSend({ ...ok, status: "PENDING" }).send).toBe(false);
    expect(wouldSend({ ...ok, status: "REJECTED" }).send).toBe(false);
  });

  it("refuses with no phone, or one we can't normalise", () => {
    expect(wouldSend({ ...ok, phone: null }).send).toBe(false);
    expect(wouldSend({ ...ok, phone: "not a number" }).send).toBe(false);
    // A reserved fictional number is stored-but-unusable, and must not send.
    expect(wouldSend({ ...ok, phone: "555-123-4567" }).send).toBe(false);
  });

  it("a STOP beats a consent flag that still says true", () => {
    // The exact disagreement an inbound STOP creates before the boolean
    // catches up. The event is newer, so it has to win.
    expect(wouldSend({ ...ok, smsConsent: true, lastEvent: "REVOKED" })).toEqual({
      send: false,
      reason: "opted out (STOP)",
    });
  });
});
