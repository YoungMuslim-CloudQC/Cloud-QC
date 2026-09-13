"use client";

import { useActionState, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { updateProfile, type ProfileState } from "@/server/actions/profile";
import { THEMES, type ThemeKey } from "@/lib/profile-schema";
import { Avatar } from "@/components/Avatar";

const INITIAL: ProfileState = {};

type Cadence = "OFF" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
type Channel = "EMAIL" | "SMS" | "BOTH";

const CHANNEL_DIGEST_NOTE: Record<Channel, string> = {
  EMAIL: "Sent to your account email.",
  SMS: "Will be sent by text once SMS notifications are live — email in the meantime.",
  BOTH: "Sent by email now; text will join once SMS notifications are live.",
};

function applyThemePreview(theme: ThemeKey) {
  document.documentElement.dataset.theme = theme;
}

export function ProfileForm({
  name,
  image,
  phone,
  theme,
  digestCadence,
  notificationChannel,
  smsConsent,
}: {
  name: string;
  image: string | null;
  phone: string | null;
  theme: string;
  digestCadence: Cadence;
  notificationChannel: Channel;
  smsConsent: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, INITIAL);
  const { update: updateSession } = useSession();

  const [phoneValue, setPhoneValue] = useState(phone ?? "");
  const [consent, setConsent] = useState(smsConsent);
  const [channel, setChannel] = useState<Channel>(notificationChannel);
  const [cadence, setCadence] = useState<Cadence>(digestCadence);
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>(
    (theme as ThemeKey) || "default",
  );

  const canText = phoneValue.trim().length > 0 && consent;
  // If phone/consent are withdrawn, an SMS/BOTH pick is no longer valid —
  // derived at render time rather than synced back via an effect. `channel`
  // still remembers the user's pick so it comes back if they re-consent.
  const effectiveChannel: Channel = canText ? channel : "EMAIL";

  // Push the new theme into the session (JWT) once the save actually lands,
  // so the rest of the app (and a future reload) picks it up without a
  // re-login. Live preview already happened on click, independent of this.
  useEffect(() => {
    if (state.ok) {
      updateSession({ user: { theme: selectedTheme } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on state.ok flip
  }, [state.ok]);

  return (
    <form action={formAction}>
      {state.error && <div className="auth-msg error">{state.error}</div>}
      {state.ok && <div className="auth-msg info">Saved.</div>}

      <div className="profile-photo-row">
        <Avatar name={name} image={image} />
        <div>
          <label htmlFor="photo">Profile photo</label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" />
          <div className="survey-time-note" style={{ marginTop: 4 }}>
            JPG, PNG, or WEBP, up to 5MB.
          </div>
        </div>
      </div>

      <div className="field">
        <label htmlFor="phone">
          Phone number <span className="optional-tag">optional</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="e.g. (555) 123-4567"
          value={phoneValue}
          onChange={(e) => setPhoneValue(e.target.value)}
        />
      </div>

      <div className="field">
        <label>Notify me by</label>
        <div className="toggle-group">
          <label className="toggle-option">
            <input
              type="radio"
              name="notificationChannel"
              value="EMAIL"
              checked={effectiveChannel === "EMAIL"}
              onChange={() => setChannel("EMAIL")}
            />
            <span>
              <span className="toggle-option-label">Email</span>
              <div className="toggle-option-desc">Sent to your account email.</div>
            </span>
          </label>
          <label className={`toggle-option${!canText ? " is-disabled" : ""}`}>
            <input
              type="radio"
              name="notificationChannel"
              value="SMS"
              checked={effectiveChannel === "SMS"}
              disabled={!canText}
              onChange={() => setChannel("SMS")}
            />
            <span>
              <span className="toggle-option-label">
                Text message
                <span className="tag-construction">Under construction</span>
              </span>
              <div className="toggle-option-desc">
                Requires a phone number and consent below. Not sending yet —
                save your preference now for when it launches.
              </div>
            </span>
          </label>
          <label className={`toggle-option${!canText ? " is-disabled" : ""}`}>
            <input
              type="radio"
              name="notificationChannel"
              value="BOTH"
              checked={effectiveChannel === "BOTH"}
              disabled={!canText}
              onChange={() => setChannel("BOTH")}
            />
            <span>
              <span className="toggle-option-label">
                Both
                <span className="tag-construction">Under construction</span>
              </span>
              <div className="toggle-option-desc">Email now, text once it&rsquo;s live.</div>
            </span>
          </label>
        </div>
      </div>

      <div className="field">
        <label className="toggle-option" style={{ alignItems: "center" }}>
          <input
            type="checkbox"
            name="smsConsent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span className="toggle-option-desc">
            I agree to receive text messages from Cloud QC at the phone number
            above once that feature launches. Message/data rates may apply.
          </span>
        </label>
      </div>

      {/* Lighter box on purpose — its content depends on the channel picked
          above, so it's set apart to read as "this part reacts". */}
      <div className="field">
        <label>Status digest</label>
        <div className="subpanel">
          <div className="status-options">
            {(
              [
                ["OFF", "Off"],
                ["WEEKLY", "Weekly"],
                ["BIWEEKLY", "Biweekly"],
                ["MONTHLY", "Monthly"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`status-opt${cadence === value ? " sel-ok" : ""}`}
                style={{ cursor: "pointer" }}
              >
                <input
                  type="radio"
                  name="digestCadence"
                  value={value}
                  checked={cadence === value}
                  onChange={() => setCadence(value)}
                  style={{ display: "none" }}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="survey-time-note" style={{ marginTop: 10 }}>
            {cadence === "OFF"
              ? "No digest emails. Sending isn't turned on yet either way — this just saves your preference."
              : CHANNEL_DIGEST_NOTE[effectiveChannel]}
          </div>
        </div>
      </div>

      <div className="field">
        <label>Appearance</label>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`theme-swatch${selectedTheme === t.key ? " active" : ""}`}
              onClick={() => {
                setSelectedTheme(t.key);
                applyThemePreview(t.key);
              }}
            >
              <span
                className="theme-swatch-preview"
                data-theme={t.key}
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), var(--secondary), var(--accent))",
                }}
              />
              <span className="theme-swatch-name">{t.label}</span>
              <span className="theme-swatch-blurb">{t.blurb}</span>
            </button>
          ))}
        </div>
        <input type="hidden" name="theme" value={selectedTheme} />
        <div className="survey-time-note">
          Click a palette to preview it — Save to keep it.
        </div>
      </div>

      <button className="btn btn-primary" type="submit" style={{ width: "auto" }} disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
