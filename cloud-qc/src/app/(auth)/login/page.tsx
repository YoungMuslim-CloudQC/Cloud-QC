import Link from "next/link";

import { googleEnabled, googleHostedDomain } from "@/lib/auth.config";
import { CloudMark } from "@/components/Brand";
import { GoogleButton } from "@/components/GoogleButton";
import { LoginForm } from "@/components/auth/LoginForm";

const ERROR_MESSAGES: Record<string, string> = {
  AccountNotApproved: "Your account is still waiting for admin approval.",
  AccessDenied: googleHostedDomain
    ? `Google sign-in is limited to @${googleHostedDomain} accounts.`
    : "That account can't sign in here.",
  OAuthAccountNotLinked:
    "This email is already registered with a different sign-in method.",
  Configuration: "Sign-in is temporarily unavailable. Try again shortly.",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const errorKey = typeof params.error === "string" ? params.error : undefined;
  const errorMsg = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? "Something went wrong signing in.")
    : undefined;

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <CloudMark />
        Cloud QC
      </div>
      <div className="auth-sub">Young Muslim &middot; QC Ops</div>

      <div className="auth-tabs">
        <span className="auth-tab active">Log in</span>
        <Link href="/signup" className="auth-tab">
          Sign up
        </Link>
      </div>

      {errorMsg && <div className="auth-msg error">{errorMsg}</div>}

      <LoginForm />

      {googleEnabled && (
        <>
          <div className="auth-divider">or</div>
          <GoogleButton />
          {googleHostedDomain && (
            <div className="auth-fine" style={{ marginTop: 8 }}>
              Google sign-in requires an @{googleHostedDomain} account.
            </div>
          )}
        </>
      )}

      <div className="auth-fine">
        New accounts need an admin to approve them before first sign-in.
      </div>
    </div>
  );
}
