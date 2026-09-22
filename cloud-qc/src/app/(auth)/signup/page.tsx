import Link from "next/link";

import { db } from "@/lib/db";
import { getRegionMap } from "@/lib/queries";
import { googleEnabled, googleHostedDomain } from "@/lib/auth.config";
import { CloudMark } from "@/components/Brand";
import { GoogleButton } from "@/components/GoogleButton";
import { SignupForm } from "@/components/auth/SignupForm";

export default async function SignupPage() {
  // Needed so someone signing up as a coordinator can say which neighbornet
  // they run. Names only.
  const [neighbornets, regionMap] = await Promise.all([
    db.neighbornet.findMany({
      where: { archivedAt: null },
      orderBy: [{ region: "asc" }, { subArea: "asc" }, { name: "asc" }],
      select: { id: true, name: true, subArea: true, region: true },
    }),
    getRegionMap(),
  ]);

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <CloudMark />
        Cloud QC
      </div>
      <div className="auth-sub">Young Muslim &middot; QC Ops</div>

      <div className="auth-tabs">
        <Link href="/login" className="auth-tab">
          Log in
        </Link>
        <span className="auth-tab active">Sign up</span>
      </div>

      <SignupForm neighbornets={neighbornets} regionMap={regionMap} />

      {googleEnabled && (
        <>
          <div className="auth-divider">or</div>
          <GoogleButton label="Sign up with Google" />
          {googleHostedDomain && (
            <div className="auth-fine" style={{ marginTop: 8 }}>
              Requires an @{googleHostedDomain} account.
            </div>
          )}
        </>
      )}

      <div className="auth-fine">
        Signing up creates a pending account. An admin approves it before your
        first sign-in.
      </div>
    </div>
  );
}
