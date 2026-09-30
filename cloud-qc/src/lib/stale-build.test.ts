import { describe, expect, it } from "vitest";

import { isStaleBuildError } from "@/lib/stale-build";

describe("isStaleBuildError", () => {
  it("recognises the ChunkLoadError name webpack throws", () => {
    const e = new Error("Loading chunk 482 failed.");
    e.name = "ChunkLoadError";
    expect(isStaleBuildError(e)).toBe(true);
  });

  it("recognises the turbopack wording, which is what production actually throws", () => {
    // Verbatim from the live site after a deploy landed under an open tab.
    expect(
      isStaleBuildError(
        new Error(
          "Failed to load chunk /_next/static/immutable/chunks/2q7qvom8eqht_.js from module 64893",
        ),
      ),
    ).toBe(true);
  });

  it("recognises the webpack wording", () => {
    expect(isStaleBuildError(new Error("Loading chunk 12 failed."))).toBe(true);
  });

  it("recognises the native dynamic-import wording browsers use", () => {
    expect(
      isStaleBuildError(new Error("Importing a module script failed.")),
    ).toBe(true);
    expect(
      isStaleBuildError(
        new Error("error loading dynamically imported module: /x.js"),
      ),
    ).toBe(true);
  });

  it("leaves ordinary application errors alone", () => {
    // These must NOT trigger a reload — reloading would just lose the page
    // and hide a real bug behind a refresh.
    expect(isStaleBuildError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleBuildError(new Error("Unauthorized"))).toBe(false);
    expect(isStaleBuildError(new Error("PrismaClientKnownRequestError"))).toBe(false);
  });

  it("does not fall over on null, undefined or odd shapes", () => {
    expect(isStaleBuildError(null)).toBe(false);
    expect(isStaleBuildError(undefined)).toBe(false);
    expect(isStaleBuildError("ChunkLoadError")).toBe(false);
    expect(isStaleBuildError({})).toBe(false);
  });

  it("matches on a bare message object, which is all an ErrorEvent gives us", () => {
    expect(isStaleBuildError({ message: "ChunkLoadError: nope" })).toBe(true);
  });
});
