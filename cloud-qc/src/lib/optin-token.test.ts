import { beforeAll, describe, expect, it } from "vitest";

import { createOptInToken, readOptInToken } from "@/lib/optin-token";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-for-signing-optin-links";
});

const DAY = 24 * 60 * 60 * 1000;

describe("opt-in link tokens", () => {
  it("round-trips the user it was made for", () => {
    const t = createOptInToken("user_abc123");
    expect(readOptInToken(t)).toBe("user_abc123");
  });

  it("refuses a token signed with a different secret", () => {
    const t = createOptInToken("user_abc123");
    process.env.AUTH_SECRET = "a-completely-different-secret";
    expect(readOptInToken(t)).toBeNull();
    process.env.AUTH_SECRET = "test-secret-for-signing-optin-links";
  });

  it("refuses a tampered user id", () => {
    // The attack this exists to stop: point someone else's account at my
    // phone, and start receiving their neighbornet's updates.
    const t = createOptInToken("user_abc123");
    const [, expires, sig] = t.split(".");
    expect(readOptInToken(`user_victim.${expires}.${sig}`)).toBeNull();
  });

  it("refuses a tampered expiry", () => {
    const now = Date.now();
    const t = createOptInToken("user_abc123", now);
    const [uid, , sig] = t.split(".");
    const farFuture = now + 365 * DAY;
    expect(readOptInToken(`${uid}.${farFuture}.${sig}`)).toBeNull();
  });

  it("expires after 30 days", () => {
    const now = Date.now();
    const t = createOptInToken("user_abc123", now);
    expect(readOptInToken(t, now + 29 * DAY)).toBe("user_abc123");
    expect(readOptInToken(t, now + 31 * DAY)).toBeNull();
  });

  it("refuses junk without throwing", () => {
    for (const junk of ["", "x", "a.b", "a.b.c.d", "....", "a.b.c"]) {
      expect(() => readOptInToken(junk)).not.toThrow();
      expect(readOptInToken(junk)).toBeNull();
    }
  });
});
