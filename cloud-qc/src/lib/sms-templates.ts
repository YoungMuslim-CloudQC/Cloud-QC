/**
 * Every text Cloud QC will send, in one place.
 *
 * These double as the sample messages submitted with the A2P 10DLC campaign,
 * so the rule is: if a message can go out, its shape is in here. A campaign
 * approved on one set of samples and then used to send something different
 * is how a sender gets filtered.
 *
 * Conventions, all of them carrier expectations rather than style choices:
 *  - Every message opens with the brand, so it's identifiable out of context.
 *  - The first message after opt-in, and any message that could be read as
 *    the start of a conversation, carries the STOP footer.
 *  - No links to anything that isn't ours, and no URL shorteners — shortened
 *    links are a common filtering trigger.
 */

import { SMS_BRAND, SMS_MAX_PER_MONTH } from "@/lib/sms-consent-copy";

/** Prefixed to every outbound message. Short, because it's paid for in
 *  segments: anything over 160 GSM-7 characters bills as two. */
export const SMS_SENDER_TAG = "Cloud QC";

export const SMS_STOP_FOOTER = "Reply STOP to opt out.";

/** Sent once, immediately after someone opts in. This is the message
 *  carriers most want to see, because it's what proves the opt-in closed
 *  the loop. */
export function smsWelcome(appUrl: string): string {
  return (
    `${SMS_SENDER_TAG}: You're signed up for text updates from ${SMS_BRAND}. ` +
    `Up to ${SMS_MAX_PER_MONTH} msgs/month. Msg&data rates may apply. ` +
    `Reply HELP for help, STOP to cancel. ${appUrl}/sms-opt-in`
  );
}

/** The automatic reply to an inbound HELP. */
export function smsHelpReply(): string {
  return (
    `${SMS_SENDER_TAG}: Young Muslims QC updates. ` +
    `Up to ${SMS_MAX_PER_MONTH} msgs/month. Msg&data rates may apply. ` +
    `Help: cloud@youngmuslims.com. Reply STOP to cancel.`
  );
}

/** The automatic reply to an inbound STOP. */
export function smsStopReply(): string {
  return (
    `${SMS_SENDER_TAG}: You've been unsubscribed from ${SMS_BRAND} texts ` +
    `and won't receive any more. Reply START to rejoin.`
  );
}

/** The digest summary, mirroring the email that already goes out. */
export function smsDigest(opts: {
  firstName: string;
  attentionCount: number;
  onTrackCount: number;
  appUrl: string;
}): string {
  const { firstName, attentionCount, onTrackCount, appUrl } = opts;
  const head =
    attentionCount > 0
      ? `${attentionCount} neighbornet${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} attention`
      : `all neighbornets on track`;
  // Plain hyphen, not an em dash. A single non-GSM-7 character forces the
  // whole message into UCS-2, which drops the segment budget from 160
  // characters to 70 — this one would go from 1 segment to 3.
  return (
    `${SMS_SENDER_TAG}: Hi ${firstName}, your QC summary - ${head}, ` +
    `${onTrackCount} on track. Details: ${appUrl}/coordinator. ${SMS_STOP_FOOTER}`
  );
}

/** Sent when QC logs a visit about a neighbornet this person looks after. */
export function smsFeedbackAlert(opts: {
  neighbornetName: string;
  appUrl: string;
}): string {
  return (
    `${SMS_SENDER_TAG}: New QC feedback was logged for ${opts.neighbornetName}. ` +
    `Read it: ${opts.appUrl}/coordinator/inbox. ${SMS_STOP_FOOTER}`
  );
}

/** Occasional operational notice from the Cloud team. */
export function smsAnnouncement(opts: { body: string; appUrl: string }): string {
  return `${SMS_SENDER_TAG}: ${opts.body} ${opts.appUrl}/dashboard. ${SMS_STOP_FOOTER}`;
}

/**
 * The exact strings to paste into Twilio's campaign registration.
 *
 * Rendered with representative values rather than placeholders, because the
 * review is done by a human reading them as a recipient would — "Hi {{1}},
 * your {{2}}" tells them nothing about whether the traffic is legitimate.
 */
export function campaignSampleMessages(appUrl = "https://cloud-qc.vercel.app"): {
  label: string;
  body: string;
}[] {
  return [
    { label: "Opt-in confirmation", body: smsWelcome(appUrl) },
    {
      label: "QC summary",
      body: smsDigest({ firstName: "Omar", attentionCount: 2, onTrackCount: 7, appUrl }),
    },
    {
      label: "New feedback alert",
      body: smsFeedbackAlert({ neighbornetName: "Teaneck", appUrl }),
    },
    {
      label: "Cloud team announcement",
      body: smsAnnouncement({
        body: "Rotation assignments for this trimester are posted.",
        appUrl,
      }),
    },
    { label: "HELP reply", body: smsHelpReply() },
    { label: "STOP reply", body: smsStopReply() },
  ];
}
