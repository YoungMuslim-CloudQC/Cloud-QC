import type { Metadata } from "next";

import { SmsOptInForm } from "@/components/sms/SmsOptInForm";

export const metadata: Metadata = {
  title: "Text Alerts — Young Muslims Cloud QC",
  description:
    "Opt in to receive Cloud QC text message alerts about your neighbornet.",
  // A carrier reviewer needs to reach this; nobody needs it in search results.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Public, deliberately outside the (app) route group so it has no sidebar
 *  and needs no session — a carrier reviewer has to be able to open it. */
export default function SmsOptInPage() {
  return (
    <main className="optin-page">
      <SmsOptInForm />
    </main>
  );
}
