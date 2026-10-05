import "server-only";

/**
 * Twilio send path.
 *
 * Plain fetch against the REST API rather than the `twilio` package: the one
 * call we make is a form POST, and the SDK would be a dependency carrying a
 * lot of surface area for that.
 *
 * Nothing calls this yet. It's here so that adding credentials is the only
 * step left — isConfigured() tells the rest of the app whether sending is
 * actually possible, so nothing has to guess or pretend.
 */

/**
 * Twilio's SID prefixes are meaningful, and the two that matter here look
 * similar enough to swap by accident: an Account SID starts AC, a Messaging
 * Service SID starts MG. Putting the account SID in the service slot gets
 * you a 404 on a URL you didn't knowingly build, which is a confusing way
 * to find out — so check the shape up front and say which one is wrong.
 */
export function configProblems(): string[] {
  const problems: string[] = [];
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!sid) problems.push("TWILIO_ACCOUNT_SID is not set");
  else if (!sid.startsWith("AC"))
    problems.push("TWILIO_ACCOUNT_SID should start with 'AC'");

  if (!token) problems.push("TWILIO_AUTH_TOKEN is not set");

  if (!service) problems.push("TWILIO_MESSAGING_SERVICE_SID is not set");
  else if (service.startsWith("AC"))
    problems.push(
      "TWILIO_MESSAGING_SERVICE_SID holds an Account SID (AC...) — it needs the Messaging Service SID, which starts with 'MG'",
    );
  else if (!service.startsWith("MG"))
    problems.push("TWILIO_MESSAGING_SERVICE_SID should start with 'MG'");

  return problems;
}

export function isConfigured(): boolean {
  return configProblems().length === 0;
}

export type SendResult =
  | { ok: true; sid: string }
  | { ok: false; error: string; code?: number };

/**
 * Send one message. `to` must already be E.164 (see lib/phone).
 *
 * Callers are responsible for checking consent first — this deliberately
 * does not look it up, so there's exactly one place that decides whether a
 * message is allowed and it isn't buried in the transport.
 */
export async function sendSms(to: string, body: string): Promise<SendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const service = process.env.TWILIO_MESSAGING_SERVICE_SID;

  const problems = configProblems();
  if (problems.length || !sid || !token || !service) {
    return { ok: false, error: `Twilio config: ${problems.join("; ")}` };
  }

  const params = new URLSearchParams({
    To: to,
    Body: body,
    MessagingServiceSid: service,
  });

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          // Basic auth is what Twilio's REST API takes.
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );

    const json = (await res.json()) as {
      sid?: string;
      message?: string;
      code?: number;
    };

    if (!res.ok) {
      // Twilio's own message is more useful than the status code, and never
      // contains the auth token.
      return {
        ok: false,
        error: json.message ?? `Twilio returned ${res.status}`,
        code: json.code,
      };
    }
    return { ok: true, sid: json.sid ?? "" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
