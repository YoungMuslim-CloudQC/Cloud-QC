/**
 * Every text Cloud QC will send, in one place.
 *
 * These are held against the toll-free verification filed for +18889877086
 * (HH7a7d9cc1...): the sender identity and message types here must match the
 * samples and use case declared there. Carriers compare live traffic to the
 * filing after approval, so a message that doesn't fit the declaration puts
 * the number's verification at risk — not just that one send.
 *
 * Conventions, all of them carrier expectations rather than style choices:
 *  - Every message opens with the brand, so it's identifiable out of context.
 *  - The first message after opt-in, and any message that could be read as
 *    the start of a conversation, carries the STOP footer.
 *  - No links to anything that isn't ours, and no URL shorteners — shortened
 *    links are a common filtering trigger.
 *  - GSM-7 characters only. One smart quote or em dash forces the whole
 *    message into UCS-2 and cuts the segment budget from 160 to 70.
 */

import { SMS_BRAND, SMS_MAX_PER_MONTH } from "@/lib/sms-consent-copy";

/**
 * Prefixed to every outbound message.
 *
 * "Young Muslims", not "Cloud QC", because that is how the sender identifies
 * itself in the declared samples. Cloud QC is the internal name of the tool;
 * the filing is in the organisation's name, and the two have to agree.
 */
export const SMS_SENDER_TAG = "Young Muslims";

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

// --- The three declared message types -------------------------------------

/** Declared sample 1: a site-visit assignment. */
export function smsVisitAssignment(opts: {
  neighbornetName: string;
  period: string;
}): string {
  return (
    `${SMS_SENDER_TAG}: You're assigned to visit the ${opts.neighbornetName} ` +
    `NeighborNet ${opts.period}. Details in your dashboard. ${SMS_STOP_FOOTER}`
  );
}

/** Declared sample 2: an outstanding visit report. */
export function smsReportReminder(opts: { period: string }): string {
  return (
    `${SMS_SENDER_TAG}: Reminder - your QC visit report for ${opts.period} ` +
    `is still pending. ${SMS_STOP_FOOTER}`
  );
}

/** Declared sample 3: a rotation change. */
export function smsRotationChange(opts: { onDate: string }): string {
  return (
    `${SMS_SENDER_TAG}: Your partner assignment rotates on ${opts.onDate}. ` +
    `Check your dashboard for the new pairing. ${SMS_STOP_FOOTER}`
  );
}

/**
 * The periodic summary.
 *
 * Sits under the declared "reminders to submit visit reports" heading: it
 * tells someone what is outstanding across the neighbornets they look after.
 * Worded as a status reminder rather than a digest so it reads as the thing
 * that was declared.
 */
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
  return (
    `${SMS_SENDER_TAG}: Hi ${firstName}, your QC status - ${head}, ` +
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
 * The strings submitted with the toll-free verification, in the order they
 * were filed. Kept here so the filing and the code can be diffed directly
 * rather than from memory.
 */
export function campaignSampleMessages(appUrl = "https://cloud-qc.vercel.app"): {
  label: string;
  body: string;
}[] {
  return [
    {
      label: "Site-visit assignment",
      body: smsVisitAssignment({ neighbornetName: "Kearny", period: "this month" }),
    },
    { label: "Visit report reminder", body: smsReportReminder({ period: "September" }) },
    { label: "Rotation change", body: smsRotationChange({ onDate: "Oct 15" }) },
    { label: "Opt-in confirmation", body: smsWelcome(appUrl) },
    {
      label: "QC status summary",
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
