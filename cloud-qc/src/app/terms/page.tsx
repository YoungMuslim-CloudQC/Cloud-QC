import type { Metadata } from "next";
import Link from "next/link";

import {
  SMS_BRAND,
  SMS_FREQUENCY_LINE,
  SMS_HELP_STOP_LINE,
  SMS_RATES_LINE,
} from "@/lib/sms-consent-copy";

export const metadata: Metadata = {
  title: "Terms of Service — Young Muslims Cloud QC",
  description: "Terms for using Cloud QC and its text message programme.",
};

const UPDATED = "October 5, 2026";

/** Public. Linked from the SMS opt-in form; must load with no session. */
export default function TermsPage() {
  return (
    <main className="legal-page">
      <article className="legal-doc">
        <h1>Terms of Service</h1>
        <p className="legal-meta">Last updated {UPDATED}</p>

        <p>
          Cloud QC is an internal tool operated by Young Muslims. By using it,
          or by opting in to its text messages, you agree to these terms.
        </p>

        <h2>Accounts</h2>
        <p>
          Accounts are for Young Muslims volunteers and staff and are approved
          by an administrator. Keep your login to yourself — you are
          responsible for what happens under your account. We may suspend an
          account that is misused.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Record feedback honestly. Do not enter information about other people
          that you would not be willing to have attributed to you, and do not
          attempt to access parts of the app you have not been given access to.
        </p>

        <h2 id="sms">Text message programme</h2>
        <p>
          {SMS_BRAND} offers an optional text message programme. The terms of
          that programme are:
        </p>
        <ul>
          <li>
            <strong>Opt-in is required.</strong> We only text numbers that have
            been submitted through our sign-up form or profile settings with
            the consent box actively checked. Consent is never assumed and is
            not a condition of membership, participation, or any purchase.
          </li>
          <li>
            <strong>What we send.</strong> QC summaries for your neighbornet,
            alerts when new QC feedback is logged about it, and occasional
            Cloud team announcements. We do not send marketing or fundraising
            texts.
          </li>
          <li>
            <strong>Frequency.</strong> {SMS_FREQUENCY_LINE}
          </li>
          <li>
            <strong>Cost.</strong> {SMS_RATES_LINE} Young Muslims does not
            charge for these messages.
          </li>
          <li>
            <strong>Opting out.</strong> {SMS_HELP_STOP_LINE} Replying STOP
            stops messages to that number. You can also turn texts off from
            your Cloud QC profile.
          </li>
          <li>
            <strong>Carriers.</strong> Supported carriers are not liable for
            delayed or undelivered messages. Delivery is not guaranteed.
          </li>
          <li>
            <strong>Changing numbers.</strong> If you give up a mobile number,
            tell us or reply STOP first, so messages do not reach whoever gets
            it next.
          </li>
        </ul>

        <h2>Your content</h2>
        <p>
          Feedback and notes you record stay the property of Young Muslims and
          are visible to the coordinators and Cloud team members responsible
          for the neighbornet in question.
        </p>

        <h2>Availability</h2>
        <p>
          Cloud QC is provided as-is, with no guarantee of uptime or that it
          will be free of errors. We may change or withdraw features.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the extent permitted by law, Young Muslims is not liable for
          indirect or consequential loss arising from use of Cloud QC or its
          text message programme.
        </p>

        <h2>Changes</h2>
        <p>
          We may update these terms; the date above will change when we do.
          Continuing to use Cloud QC means you accept the current version.
        </p>

        <h2>Contact</h2>
        <p>
          <a href="mailto:cloud@youngmuslims.com">cloud@youngmuslims.com</a>
        </p>

        <p className="legal-foot">
          <Link href="/sms-opt-in">Back to text alert sign-up</Link>
          {" · "}
          <Link href="/privacy">Privacy Policy</Link>
        </p>
      </article>
    </main>
  );
}
