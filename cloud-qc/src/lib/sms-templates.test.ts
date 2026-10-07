import { describe, expect, it } from "vitest";

import {
  campaignSampleMessages,
  smsHelpReply,
  smsReportReminder,
  smsRotationChange,
  smsStopReply,
  smsVisitAssignment,
  SMS_SENDER_TAG,
} from "@/lib/sms-templates";

describe("SMS templates", () => {
  const samples = campaignSampleMessages();

  it("every message identifies the sender", () => {
    for (const s of samples) {
      expect(s.body, s.label).toMatch(/^Young Muslims:/);
    }
  });

  it("messages that need an opt-out route carry one", () => {
    // The STOP reply itself is the exception — telling someone who just
    // opted out to reply STOP would be nonsense.
    for (const s of samples.filter((x) => x.label !== "STOP reply")) {
      expect(s.body, s.label).toMatch(/STOP/);
    }
  });

  it("HELP reply carries the disclosures carriers require of it", () => {
    const body = smsHelpReply();
    expect(body).toMatch(/msgs?\/month/i);
    expect(body).toMatch(/rates may apply/i);
    expect(body).toMatch(/STOP/);
    expect(body).toMatch(/@/); // a contact route
  });

  it("STOP reply confirms the opt-out and says how to come back", () => {
    expect(smsStopReply()).toMatch(/unsubscribed/i);
    expect(smsStopReply()).toMatch(/START/);
  });

  it("uses no URL shorteners and links only to our own domain", () => {
    for (const s of samples) {
      for (const url of s.body.match(/https?:\/\/\S+/g) ?? []) {
        expect(url, s.label).toMatch(/^https:\/\/cloud-qc\.vercel\.app\//);
      }
    }
  });

  it("stays inside a sane segment count", () => {
    // 160 GSM-7 chars is one segment; concatenated messages drop to 153 each.
    // Three segments is the point where cost and truncation risk stop being
    // worth it, so that's the line.
    for (const s of samples) {
      const segments = s.body.length <= 160 ? 1 : Math.ceil(s.body.length / 153);
      expect(segments, `${s.label} (${s.body.length} chars)`).toBeLessThanOrEqual(3);
    }
  });

  it("sticks to GSM-7 characters so nothing forces a UCS-2 encoding", () => {
    // A single smart quote or emoji halves the per-segment budget to 70.
    for (const s of samples) {
      expect(s.body, s.label).not.toMatch(/[^\x20-\x7E\n\r]/);
    }
  });
});

describe("agreement with the toll-free verification filing", () => {
  // Filed 2026-10-05 for +18889877086, request HH7a7d9cc1... These are the
  // samples Twilio is reviewing. Carriers compare live traffic against them
  // after approval, so drifting from this wording risks the number itself,
  // not just one message. If the filing is ever amended, change it here in
  // the same commit.
  it("sends the declared site-visit assignment wording", () => {
    expect(
      smsVisitAssignment({ neighbornetName: "Kearny", period: "this month" }),
    ).toBe(
      "Young Muslims: You're assigned to visit the Kearny NeighborNet this month. Details in your dashboard. Reply STOP to opt out.",
    );
  });

  it("sends the declared report reminder wording", () => {
    expect(smsReportReminder({ period: "September" })).toBe(
      "Young Muslims: Reminder - your QC visit report for September is still pending. Reply STOP to opt out.",
    );
  });

  it("sends the declared rotation change wording", () => {
    expect(smsRotationChange({ onDate: "Oct 15" })).toBe(
      "Young Muslims: Your partner assignment rotates on Oct 15. Check your dashboard for the new pairing. Reply STOP to opt out.",
    );
  });

  it("identifies the sender as the organisation named on the filing", () => {
    // "Cloud QC" is the internal tool name; the filing is in the
    // organisation's name, and the recipient has to see that one.
    expect(SMS_SENDER_TAG).toBe("Young Muslims");
    for (const s of campaignSampleMessages()) {
      expect(s.body, s.label).not.toMatch(/^Cloud QC:/);
    }
  });
});
