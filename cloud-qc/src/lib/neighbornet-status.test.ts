import { describe, expect, it } from "vitest";

import { hysteresisStatus, needsFollowup } from "./neighbornet-status";

type V = { visitDate: string; status: string | null };
const v = (date: string, status: string | null): V => ({
  visitDate: date,
  status,
});

describe("hysteresisStatus", () => {
  it("returns null with no visits", () => {
    expect(hysteresisStatus([])).toBeNull();
  });

  it("returns null when no visit has a status", () => {
    expect(
      hysteresisStatus([v("2026-01-01", null), v("2026-02-01", null)]),
    ).toBeNull();
  });

  it("ignores unrated visits and uses the rated ones", () => {
    expect(
      hysteresisStatus([v("2026-01-01", null), v("2026-01-02", "URGENT")]),
    ).toBe("URGENT");
  });

  it("a single day just uses that day's status", () => {
    expect(hysteresisStatus([v("2026-01-01", "NEEDS_FOLLOWUP")])).toBe(
      "NEEDS_FOLLOWUP",
    );
  });

  it("jumps straight up when a later day is worse", () => {
    expect(
      hysteresisStatus([v("2026-01-01", "ON_TRACK"), v("2026-02-01", "URGENT")]),
    ).toBe("URGENT");
  });

  it("holds when a later day has equal severity (no step)", () => {
    expect(
      hysteresisStatus([
        v("2026-01-01", "NEEDS_FOLLOWUP"),
        v("2026-02-01", "NEEDS_FOLLOWUP"),
      ]),
    ).toBe("NEEDS_FOLLOWUP");
  });

  it("steps down only one level when a later day is better", () => {
    // URGENT -> (better day) -> NEEDS_FOLLOWUP, not all the way to ON_TRACK
    expect(
      hysteresisStatus([
        v("2026-01-01", "URGENT"),
        v("2026-02-01", "ON_TRACK"),
      ]),
    ).toBe("NEEDS_FOLLOWUP");
  });

  it("recovers gradually across several good days", () => {
    expect(
      hysteresisStatus([
        v("2026-01-01", "URGENT"), // baseline URGENT
        v("2026-01-02", "ON_TRACK"), // step down -> NEEDS_FOLLOWUP
        v("2026-01-03", "ON_TRACK"), // step down -> ON_TRACK
        v("2026-01-04", "ON_TRACK"), // holds -> ON_TRACK
      ]),
    ).toBe("ON_TRACK");
  });

  it("re-escalates immediately mid-recovery", () => {
    expect(
      hysteresisStatus([
        v("2026-01-01", "URGENT"), // URGENT
        v("2026-01-02", "ON_TRACK"), // -> NEEDS_FOLLOWUP
        v("2026-01-03", "URGENT"), // jump -> URGENT
      ]),
    ).toBe("URGENT");
  });

  it("orders days chronologically regardless of input order", () => {
    expect(
      hysteresisStatus([
        v("2026-03-01", "ON_TRACK"),
        v("2026-01-01", "URGENT"),
        v("2026-02-01", "ON_TRACK"),
      ]),
    ).toBe("ON_TRACK"); // URGENT -> NEEDS_FOLLOWUP -> ON_TRACK
  });

  describe("multiple visits on the same day", () => {
    it("uses the worse severity of two same-day visits", () => {
      expect(
        hysteresisStatus([
          v("2026-01-01", "ON_TRACK"),
          v("2026-01-01", "NEEDS_FOLLOWUP"),
        ]),
      ).toBe("NEEDS_FOLLOWUP");
    });

    it("worst-of-day feeds the step logic (jump), not each visit separately", () => {
      // day 1 baseline ON_TRACK; day 2 has ON_TRACK + URGENT -> day is URGENT
      expect(
        hysteresisStatus([
          v("2026-01-01", "ON_TRACK"),
          v("2026-02-01", "ON_TRACK"),
          v("2026-02-01", "URGENT"),
        ]),
      ).toBe("URGENT");
    });

    it("two same-day visits of equal severity count as one step, not two", () => {
      // baseline URGENT; next day is two ON_TRACK visits -> ONE step down
      expect(
        hysteresisStatus([
          v("2026-01-01", "URGENT"),
          v("2026-01-02", "ON_TRACK"),
          v("2026-01-02", "ON_TRACK"),
        ]),
      ).toBe("NEEDS_FOLLOWUP");
    });

    it("same-day duplicates don't change a single-day result", () => {
      expect(
        hysteresisStatus([
          v("2026-01-01", "NEEDS_FOLLOWUP"),
          v("2026-01-01", "NEEDS_FOLLOWUP"),
        ]),
      ).toBe("NEEDS_FOLLOWUP");
    });
  });

  it("accepts Date objects as well as ISO strings", () => {
    expect(
      hysteresisStatus([
        { visitDate: new Date("2026-01-01T00:00:00Z"), status: "URGENT" },
        { visitDate: new Date("2026-02-01T00:00:00Z"), status: "ON_TRACK" },
      ]),
    ).toBe("NEEDS_FOLLOWUP");
  });
});

describe("needsFollowup", () => {
  it("is true for NEEDS_FOLLOWUP and URGENT only", () => {
    expect(needsFollowup("URGENT")).toBe(true);
    expect(needsFollowup("NEEDS_FOLLOWUP")).toBe(true);
    expect(needsFollowup("ON_TRACK")).toBe(false);
    expect(needsFollowup(null)).toBe(false);
  });
});
