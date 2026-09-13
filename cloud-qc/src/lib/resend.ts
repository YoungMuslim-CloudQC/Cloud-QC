import "server-only";

import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error(
      "RESEND_API_KEY is not set — add it to .env (see .env.example).",
    );
  }
  client ??= new Resend(process.env.RESEND_API_KEY);
  return client;
}

export async function sendDigestEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const from = process.env.DIGEST_FROM_EMAIL;
  if (!from) {
    return { ok: false, error: "DIGEST_FROM_EMAIL is not set." };
  }
  try {
    const result = await getClient().emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
