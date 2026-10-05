import { describe, expect, it } from "vitest";

import { campaignSampleMessages, smsHelpReply, smsStopReply } from "@/lib/sms-templates";

describe("SMS templates", () => {
  const samples = campaignSampleMessages();

  it("every message identifies the sender", () => {
    for (const s of samples) {
      expect(s.body, s.label).toMatch(/^Cloud QC:/);
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
