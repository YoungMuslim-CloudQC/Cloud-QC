import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/authz";
import { CloudMark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";

export default async function PendingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.status === "APPROVED") redirect("/dashboard");

  const rejected = user.status === "REJECTED";

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <CloudMark />
          Cloud QC
        </div>
        <div className="auth-sub">Young Muslim &middot; QC Ops</div>

        <div className={`auth-msg ${rejected ? "error" : "info"}`}>
          {rejected
            ? "This account wasn't approved. Reach out to a Cloud admin if you think that's a mistake."
            : "Your account is waiting for an admin to approve it. You'll be able to sign in once that's done."}
        </div>

        <p className="auth-fine" style={{ marginTop: 0 }}>
          Signed in as {user.email}.
        </p>

        <SignOutButton className="btn btn-secondary" >
          Sign out
        </SignOutButton>
      </div>
    </div>
  );
}
