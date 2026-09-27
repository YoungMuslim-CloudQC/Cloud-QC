import { describe, expect, it } from "vitest";

import { buildCoSuggestions, matchesName } from "@/lib/co-visitors";

const members = [
  { id: "a", label: "Abdul-Malik Aziz", subArea: "NJ North" },
  { id: "b", label: "Akmal Pasha", subArea: null },
  { id: "c", label: "Moeez Shahid", subArea: "NJ North" },
  { id: "d", label: "Omar Abdelmenam", subArea: "NJ South" },
  { id: "e", label: "Omar Elfar", subArea: "NJ South" },
  { id: "f", label: "Samih Wadi", subArea: "NJ North" },
  { id: "g", label: "aaiz umair", subArea: null },
];

describe("matchesName", () => {
  it("matches on first name", () => {
    expect(matchesName("Omar Elfar", "omar")).toBe(true);
  });

  it("matches on last name", () => {
    expect(matchesName("Omar Elfar", "elfar")).toBe(true);
  });

  it("matches a mid-word run", () => {
    expect(matchesName("Abdul-Malik Aziz", "malik")).toBe(true);
  });

  it("matches first and last initials typed together", () => {
    expect(matchesName("Omar Elfar", "om el")).toBe(true);
  });

  it("ignores case and surrounding space", () => {
    expect(matchesName("Samih Wadi", "  SAMIH ")).toBe(true);
  });

  it("rejects a non-match", () => {
    expect(matchesName("Omar Elfar", "zzz")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(matchesName("Anyone", "")).toBe(true);
  });
});

describe("buildCoSuggestions", () => {
  it("puts recent co-visitors first, in the order given", () => {
    const out = buildCoSuggestions({
      members,
      recentIds: ["e", "c"],
      homeSubArea: "NJ North",
      taken: [],
    });
    expect(out.slice(0, 2).map((m) => m.id)).toEqual(["e", "c"]);
  });

  it("fills the rest from the user's own sub-region before everyone else", () => {
    const out = buildCoSuggestions({
      members,
      recentIds: ["e"],
      homeSubArea: "NJ North",
      taken: [],
      limit: 4,
    });
    // "e" is the recent one; then the NJ North members, alphabetically.
    expect(out.map((m) => m.id)).toEqual(["e", "a", "c", "f"]);
  });

  it("falls back to plain alphabetical when no home sub-region is set", () => {
    const out = buildCoSuggestions({
      members,
      recentIds: [],
      homeSubArea: null,
      taken: [],
      limit: 3,
    });
    expect(out.map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("still fills up when only one recent co-visitor exists", () => {
    const out = buildCoSuggestions({
      members,
      recentIds: ["d"],
      homeSubArea: "NJ North",
      taken: [],
      limit: 5,
    });
    expect(out[0].id).toBe("d");
    expect(out).toHaveLength(5);
  });

  it("never exceeds the limit", () => {
    const out = buildCoSuggestions({
      members,
      recentIds: ["a", "b", "c"],
      homeSubArea: "NJ North",
      taken: [],
      limit: 4,
    });
    expect(out).toHaveLength(4);
  });

  it("drops anyone already added", () => {
    const out = buildCoSuggestions({
      members,
      recentIds: ["e", "c"],
      homeSubArea: "NJ North",
      taken: ["e", "a"],
    });
    const ids = out.map((m) => m.id);
    expect(ids).not.toContain("e");
    expect(ids).not.toContain("a");
    expect(ids[0]).toBe("c");
  });

  it("never repeats someone who qualifies twice over", () => {
    // "c" is both a recent co-visitor and in the home sub-region.
    const out = buildCoSuggestions({
      members,
      recentIds: ["c"],
      homeSubArea: "NJ North",
      taken: [],
    });
    expect(out.filter((m) => m.id === "c")).toHaveLength(1);
  });

  it("applies the search query across the whole ordering", () => {
    const out = buildCoSuggestions({
      members,
      recentIds: ["c"],
      homeSubArea: "NJ North",
      taken: [],
      query: "omar",
    });
    expect(out.map((m) => m.id)).toEqual(["d", "e"]);
  });

  it("returns nothing when the query matches no one", () => {
    const out = buildCoSuggestions({
      members,
      recentIds: ["c"],
      homeSubArea: "NJ North",
      taken: [],
      query: "zzzz",
    });
    expect(out).toEqual([]);
  });
});
