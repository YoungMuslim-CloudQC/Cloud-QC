import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Young Muslims Cloud QC",
  description: "How Cloud QC handles your information.",
};

const UPDATED = "October 5, 2026";

/** Public. Linked from the SMS opt-in form, and carriers do open it as part
 *  of campaign review — it has to load with no session. */
export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article className="legal-doc">
        <h1>Privacy Policy</h1>
        <p className="legal-meta">Last updated {UPDATED}</p>

        <p>
          Cloud QC is an internal tool operated by Young Muslims for tracking
          quality-control visits to its neighbornets. This policy explains what
          it collects and what happens to it.
        </p>

        <h2>Who this covers</h2>
        <p>
          Cloud QC accounts are for Young Muslims volunteers and staff. It is
          not a consumer service and is not directed to children.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong> — your name, email address and,
            if you choose to add one, a mobile phone number.
          </li>
          <li>
            <strong>Your activity in the app</strong> — the visits you record,
            the ratings and notes you write, and which neighbornets you are
            associated with.
          </li>
          <li>
            <strong>Preferences</strong> — your region, how often you want
            summaries, and whether you want them by email or text.
          </li>
          <li>
            <strong>SMS consent records</strong> — if you opt in to text
            messages we store your number, the date and time, the exact
            wording you agreed to, and the IP address and browser the request
            came from. We keep this because we have to be able to show that
            consent was given, and what it was given to.
          </li>
        </ul>

        <h2>How we use it</h2>
        <p>
          To run the app: showing you your neighbornets, sending the digest
          summaries you asked for, and letting coordinators see feedback about
          the neighbornets they look after. We do not use it for advertising.
        </p>

        <h2>Text messages</h2>
        <p>
          Text messages are sent only to numbers that have opted in. We send
          QC summaries, alerts when new feedback is logged about your
          neighbornet, and occasional operational announcements.
        </p>
        <p>
          <strong>
            We do not send marketing or fundraising texts, and we do not sell
            or share your mobile number with anyone.
          </strong>{" "}
          No mobile information is shared with third parties or affiliates for
          marketing purposes.
        </p>
        <p>
          Reply <strong>STOP</strong> to any message to stop receiving them, or{" "}
          <strong>HELP</strong> for help. You can also change this at any time
          from your profile in Cloud QC.
        </p>

        <h2>Who else sees it</h2>
        <ul>
          <li>
            <strong>Other Young Muslims volunteers</strong> — coordinators and
            the Cloud team can see feedback relating to the neighbornets they
            are responsible for, and who recorded it.
          </li>
          <li>
            <strong>Service providers</strong> — the app runs on Vercel, uses
            Supabase for its database, Resend for email, and a messaging
            provider for text messages. They process this data on our behalf
            and are not permitted to use it for anything else.
          </li>
          <li>
            <strong>Nobody else.</strong> We do not sell your information.
          </li>
        </ul>

        <h2>How long we keep it</h2>
        <p>
          Account and activity data is kept while the account is active. SMS
          consent and opt-out records are kept for at least four years after
          the number is last active, because we are required to be able to
          evidence them.
        </p>

        <h2>Your choices</h2>
        <ul>
          <li>Change your contact preferences from your profile.</li>
          <li>Reply STOP to any text to stop texts immediately.</li>
          <li>
            Ask us to correct or delete your account information by contacting
            us below.
          </li>
        </ul>

        <h2>Security</h2>
        <p>
          Access requires a password and an approved account, and data is
          encrypted in transit. No system is perfectly secure, and we do not
          claim otherwise.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes we will update the date at the top. Consent
          records always store the wording that was shown at the time, not the
          current wording.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy or your data:{" "}
          <a href="mailto:cloud@youngmuslims.com">cloud@youngmuslims.com</a>.
        </p>

        <p className="legal-foot">
          <Link href="/sms-opt-in">Back to text alert sign-up</Link>
          {" · "}
          <Link href="/terms">Terms of Service</Link>
        </p>
      </article>
    </main>
  );
}
