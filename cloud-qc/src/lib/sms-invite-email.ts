import "server-only";

import {
  SMS_FREQUENCY_LINE,
  SMS_HELP_STOP_LINE,
  SMS_MESSAGE_TYPES,
  SMS_NO_MARKETING_LINE,
  SMS_RATES_LINE,
} from "@/lib/sms-consent-copy";

/**
 * The one-off email inviting members to turn on text updates.
 *
 * Deliberately does not collect a phone number itself — it links to the
 * opt-in page. Consent has to be given by the person, on a page that shows
 * them the terms, or the record isn't worth anything. An email that said
 * "reply with your number" would produce numbers with no consent behind
 * them, which is the one thing we can't use.
 */
export function smsInviteEmail(opts: {
  firstName: string;
  appUrl: string;
  /** Signed token identifying the recipient, so their consent lands on
   *  their account rather than floating free. Without it they would opt in
   *  and then never be reachable, because almost nobody has a phone number
   *  on their profile yet. */
  token: string;
}): { subject: string; html: string } {
  const subject = "Want your Cloud QC updates by text?";

  const optInUrl = `${opts.appUrl}/sms-opt-in?u=${encodeURIComponent(opts.token)}`;

  const types = SMS_MESSAGE_TYPES.map(
    (t) =>
      `<li style="margin-bottom:6px;"><strong style="color:#ede9fe;">${t.title}:</strong> ${t.body}</li>`,
  ).join("");

  const html = `
  <div style="background:#0d0821;padding:32px 16px;font-family:Inter,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#170f32;border:1px solid #2c2258;border-radius:14px;padding:28px;">
      <div style="font-weight:700;font-size:19px;color:#c4b5fd;margin-bottom:4px;">&#9729; Cloud QC</div>
      <div style="color:#948CBB;font-size:12.5px;margin-bottom:20px;">Young Muslim &middot; QC Ops</div>

      <div style="color:#ede9fe;font-size:14px;line-height:1.6;margin-bottom:14px;">
        Hi ${opts.firstName}, you can now get your Cloud QC updates by text
        instead of digging through email. It&rsquo;s optional &mdash; email
        carries on exactly as it is if you&rsquo;d rather leave it.
      </div>

      <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#948CBB;margin:18px 0 8px;">
        What you&rsquo;d receive
      </div>
      <ul style="margin:0 0 16px;padding-left:18px;color:#948CBB;font-size:13px;line-height:1.6;">
        ${types}
      </ul>

      <div style="color:#948CBB;font-size:12.5px;line-height:1.6;margin-bottom:18px;">
        ${SMS_FREQUENCY_LINE} ${SMS_RATES_LINE} ${SMS_HELP_STOP_LINE}<br />
        ${SMS_NO_MARKETING_LINE}
      </div>

      <a href="${optInUrl}"
         style="display:inline-block;background:#7c3aed;color:#fff;text-decoration:none;font-weight:600;font-size:13.5px;padding:11px 20px;border-radius:7px;">
        Turn on text updates
      </a>

      <div style="color:#5f5789;font-size:11px;margin-top:22px;line-height:1.5;">
        You&rsquo;re getting this because you have a Cloud QC account. No
        action needed if you&rsquo;re happy with email &mdash; this is the
        only message we&rsquo;ll send about it.
      </div>
    </div>
  </div>`;

  return { subject, html };
}
