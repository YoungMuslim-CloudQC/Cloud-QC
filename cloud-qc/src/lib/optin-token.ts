import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * A signed "this link belongs to this account" token for the SMS opt-in
 * email.
 *
 * The opt-in page is public — a carrier reviewer has to be able to open it
 * with no account — so it can't rely on a session to know who is opting in.
 * Matching on the phone number alone doesn't work either, because almost
 * nobody has one saved on their profile yet, which is the whole reason for
 * the invitation.
 *
 * So the email carries the identity. Signed, because an unsigned user id in
 * a URL would let anyone opt someone else's account in — or, worse, point
 * their own phone number at a colleague's account and start receiving that
 * person's neighbornet updates.
 *
 * Tokens expire: an old email forwarded on months later shouldn't still
 * link a stranger's phone to the original recipient's account.
 */

const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set — cannot sign opt-in links.");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** `<userId>.<expiryMs>.<signature>`, URL-safe. */
export function createOptInToken(userId: string, now = Date.now()): string {
  const expires = now + TTL_MS;
  const payload = `${userId}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

/** The user id, or null if the token is malformed, expired or not ours. */
export function readOptInToken(token: string, now = Date.now()): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresRaw, signature] = parts;
  if (!userId || !expiresRaw || !signature) return null;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < now) return null;

  const expected = sign(`${userId}.${expiresRaw}`);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  // Compared in constant time so the signature can't be guessed a byte at a
  // time from how long the comparison takes.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  return userId;
}
