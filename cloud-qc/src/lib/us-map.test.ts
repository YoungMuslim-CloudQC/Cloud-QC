import { geoMercator } from "d3-geo";
import { describe, expect, it } from "vitest";

import { loadStatesTopo, stateFeature, STATE_NAMES } from "./us-map";

describe("us-map", () => {
  it("stateFeature resolves a real state and rejects junk", async () => {
    const topo = await loadStatesTopo();
    expect(stateFeature(topo, "nj")?.properties?.name).toBe("New Jersey");
    expect(stateFeature(topo, "ZZ")).toBeNull();
    expect(stateFeature(topo, null)).toBeNull();
    expect(stateFeature(topo, "")).toBeNull();
  });

  it("covers every 2-letter code with a us-atlas outline", async () => {
    const topo = await loadStatesTopo();
    for (const code of Object.keys(STATE_NAMES)) {
      expect(stateFeature(topo, code), `${code} has an outline`).not.toBeNull();
    }
  });

  it("projection.invert recovers the clicked coordinate (round-trip)", async () => {
    const topo = await loadStatesTopo();
    const nj = stateFeature(topo, "NJ")!;
    const projection = geoMercator().fitExtent(
      [
        [20, 20],
        [620, 500],
      ],
      nj,
    );

    // Teaneck, NJ — a point that should sit inside the outline's bounding box.
    const coord: [number, number] = [-74.0154, 40.8976];
    const pixel = projection(coord)!;
    const recovered = projection.invert!(pixel)!;

    expect(recovered[0]).toBeCloseTo(coord[0], 4);
    expect(recovered[1]).toBeCloseTo(coord[1], 4);
  });
});
