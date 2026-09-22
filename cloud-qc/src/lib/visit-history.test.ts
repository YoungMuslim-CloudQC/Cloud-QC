import { describe, expect, it } from "vitest";

import { buildVisitSnapshot, type VisitForSnapshot } from "./visit-history";

const base: VisitForSnapshot = {
  neighbornets: [{ neighbornet: { name: "Teaneck" } }],
  visitDate: new Date("2026-02-03T00:00:00.000Z"),
  groupSize: 24,
  avgAge: 15,
  foodRating: 4,
  leadershipRating: null,
  halaqahRating: 3,
  status: "NEEDS_FOLLOWUP",
  notes: "Solid turnout.",
  feedbackSent: false,
  submittedById: "u1",
  submittedBy: { name: "Alice", email: "a@x.com" },
  participants: [
    { role: "SUBMITTER", userId: "u1", user: { name: "Alice" } },
    { role: "CO_VISITOR", userId: "u2", user: { name: "Bob" } },
    { role: "CO_VISITOR", userId: "u3", user: { name: null, email: "c@x.com" } },
  ],
};

describe("buildVisitSnapshot", () => {
  it("captures scalar fields and the ISO visit date", () => {
    const s = buildVisitSnapshot(base);
    expect(s).toMatchObject({
      neighbornetNames: ["Teaneck"],
      visitDate: "2026-02-03",
      groupSize: 24,
      avgAge: 15,
      foodRating: 4,
      leadershipRating: null,
      halaqahRating: 3,
      status: "NEEDS_FOLLOWUP",
      notes: "Solid turnout.",
      feedbackSent: false,
      submittedById: "u1",
      submittedByName: "Alice",
    });
  });

  it("lists only co-visitors, resolving names (falls back to email)", () => {
    const s = buildVisitSnapshot(base);
    expect(s.coVisitors).toEqual([
      { userId: "u2", name: "Bob" },
      { userId: "u3", name: "c@x.com" },
    ]);
  });

  it("accepts an ISO string visitDate", () => {
    const s = buildVisitSnapshot({ ...base, visitDate: "2026-02-03" });
    expect(s.visitDate).toBe("2026-02-03");
  });

  it("is JSON-serializable (no Date instances leak through)", () => {
    const s = buildVisitSnapshot(base);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
