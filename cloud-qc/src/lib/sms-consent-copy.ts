/**
 * The exact wording shown on the opt-in form.
 *
 * Kept in one place and imported by both the form and the action that writes
 * the consent record, so what gets stored as proof is literally the string
 * that was on screen — not a paraphrase that drifts the first time someone
 * edits the page.
 *
 * Everything here has to stay true of what Cloud QC actually sends. The
 * carrier review compares this against the campaign description, and a form
 * promising message types the campaign doesn't declare (or the other way
 * round) is one of the common rejection reasons.
 */

export const SMS_BRAND = "Young Muslims Cloud QC";

/** The ceiling quoted on the form. Weekly digests are ~4-5 a month and
 *  feedback alerts are event-driven, so this is a real upper bound with
 *  headroom rather than an average. */
export const SMS_MAX_PER_MONTH = 8;

export const SMS_HELP_KEYWORD = "HELP";
export const SMS_STOP_KEYWORD = "STOP";

/** The checkbox label. This is the sentence the person is agreeing to, so
 *  it names the sender, the message types and the frequency on its own —
 *  it has to stand up without the surrounding page.
 *
 *  The message types here must match the use case declared on the toll-free
 *  verification. A reviewer opens this page and compares it against the
 *  submission, and a page promising different things than the filing is a
 *  rejection on its own. */
export const SMS_CONSENT_TEXT =
  `Yes, I would like to receive automated text messages from ${SMS_BRAND} ` +
  `about my site-visit assignments, rotation changes, and reminders to ` +
  `submit visit reports. I understand I will receive up to ` +
  `${SMS_MAX_PER_MONTH} messages per month.`;

/** Spelled out beneath the checkbox so nobody has to infer it. */
export const SMS_MESSAGE_TYPES = [
  {
    title: "Site-visit assignments",
    body: "Which neighbornet you are visiting, and when it is due.",
  },
  {
    title: "Rotation changes",
    body: "When your partner assignment or rotation changes.",
  },
  {
    title: "Visit report reminders",
    body: "A nudge when a visit report you owe is still outstanding, and a summary of how the neighbornets you look after are doing.",
  },
] as const;

export const SMS_FREQUENCY_LINE = `You will receive up to ${SMS_MAX_PER_MONTH} messages per month.`;

export const SMS_RATES_LINE =
  "Message and data rates may apply depending on your mobile phone service plan.";

export const SMS_HELP_STOP_LINE =
  `Reply ${SMS_HELP_KEYWORD} for help or ${SMS_STOP_KEYWORD} to cancel at any time.`;

export const SMS_AGREEMENT_LINE =
  `By providing your phone number and checking the box above, you agree to ` +
  `receive text messages from ${SMS_BRAND}. Consent is not a condition of ` +
  `membership, participation, or any purchase.`;

/** No marketing, no third parties — stated plainly because it's the thing
 *  people are actually worried about when they hand over a number. */
export const SMS_NO_MARKETING_LINE =
  "We do not send marketing or fundraising texts, and we never sell or share your number with anyone else.";
