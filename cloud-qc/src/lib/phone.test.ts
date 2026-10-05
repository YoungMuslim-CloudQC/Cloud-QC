import { describe, expect, it } from "vitest";

import { formatE164, maskE164, toE164 } from "@/lib/phone";

describe("toE164", () => {
  it("accepts the shapes people actually type, and collapses them to one", () => {
    const want = "+12015551234";
    for (const input of [
      "2015551234",
      "201-555-1234",
      "(201) 555-1234",
      "201.555.1234",
      "+1 201 555 1234",
      "1 (201) 555-1234",
      "  201 555 1234  ",
    ]) {
      expect(toE164(input), input).toBe(want);
    }
  });

  it("rejects numbers that can't be real", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("123")).toBeNull();
    expect(toE164("20155512345678")).toBeNull();
    // Area code and exchange must start 2-9.
    expect(toE164("0015551234")).toBeNull();
    expect(toE164("2010551234")).toBeNull();
    expect(toE164("2011551234")).toBeNull();
    // Wrong country code.
    expect(toE164("442015551234")).toBeNull();
  });

  it("rejects the reserved 555-01xx fictional range", () => {
    // Including the number printed on the example form itself — stored as a
    // real opt-in that would be consent proof for a number that can't exist.
    expect(toE164("5551234567")).toBeNull();
    expect(toE164("201-555-0123")).toBeNull();
    expect(toE164("201-555-0100")).toBeNull();
    expect(toE164("201-555-0199")).toBeNull();
  });

  it("allows 555 numbers outside the reserved block", () => {
    expect(toE164("201-555-9876")).toBe("+12015559876");
  });
});

describe("formatE164", () => {
  it("renders a stored number back in a readable form", () => {
    expect(formatE164("+12015551234")).toBe("(201) 555-1234");
  });
  it("passes anything unexpected through untouched", () => {
    expect(formatE164("+442015551234")).toBe("+442015551234");
  });
});

describe("maskE164", () => {
  it("keeps only the last four digits", () => {
    expect(maskE164("+12015551234")).toBe("(•••) •••-1234");
  });
  it("reveals nothing for an unexpected shape", () => {
    expect(maskE164("garbage")).toBe("••••");
  });
});
