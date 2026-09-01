import { describe, expect, it } from "vitest";

import { neighbornetSchema } from "./neighbornet-schema";

const base = { name: "Paterson", region: "Northeast", stateCode: "NJ" };

describe("neighbornetSchema", () => {
  it("accepts a minimal valid record", () => {
    const r = neighbornetSchema.safeParse(base);
    expect(r.success).toBe(true);
  });

  it("requires a stateCode", () => {
    const r = neighbornetSchema.safeParse({ name: "X", region: "Y" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.path[0] === "stateCode")?.message).toBe(
      "Pick a state",
    );
  });

  it("rejects a stateCode that isn't a real US code", () => {
    const r = neighbornetSchema.safeParse({ ...base, stateCode: "MW" });
    expect(r.success).toBe(false);
    expect(
      r.error?.issues.find((i) => i.path[0] === "stateCode")?.message,
    ).toBe("Pick a valid US state");
  });

  it("rejects an empty stateCode", () => {
    const r = neighbornetSchema.safeParse({ ...base, stateCode: "" });
    expect(r.success).toBe(false);
  });

  it("normalizes a lowercase stateCode", () => {
    const r = neighbornetSchema.safeParse({ ...base, stateCode: "nj" });
    expect(r.success && r.data.stateCode).toBe("NJ");
  });

  it("treats subArea as optional (empty -> undefined)", () => {
    const r = neighbornetSchema.safeParse({ ...base, subArea: "" });
    expect(r.success).toBe(true);
    expect(r.success && r.data.subArea).toBeUndefined();
  });

  it("keeps a provided subArea", () => {
    const r = neighbornetSchema.safeParse({ ...base, subArea: "North NJ" });
    expect(r.success && r.data.subArea).toBe("North NJ");
  });

  it("coerces lat/lng and rejects out-of-range", () => {
    const ok = neighbornetSchema.safeParse({
      ...base,
      latitude: "40.9",
      longitude: "-74.1",
    });
    expect(ok.success && ok.data.latitude).toBe(40.9);

    const bad = neighbornetSchema.safeParse({ ...base, latitude: "200" });
    expect(bad.success).toBe(false);
  });
});
