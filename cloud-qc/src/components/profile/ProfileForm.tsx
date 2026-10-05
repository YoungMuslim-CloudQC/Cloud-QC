"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

import { updateProfile, type ProfileState } from "@/server/actions/profile";
import { THEMES, type ThemeKey } from "@/lib/profile-schema";
import type { RegionMap } from "@/lib/queries";
import { Avatar } from "@/components/Avatar";
import { AreaMultiSelect } from "@/components/profile/AreaMultiSelect";
import { SubRegionSelect } from "@/components/SubRegionSelect";
import { flattenRegionMap, parseArea, subValue } from "@/lib/sub-regions";
import {
  SMS_CONSENT_TEXT,
  SMS_FREQUENCY_LINE,
  SMS_HELP_STOP_LINE,
  SMS_NO_MARKETING_LINE,
  SMS_RATES_LINE,
} from "@/lib/sms-consent-copy";

const INITIAL: ProfileState = {};

type Cadence = "OFF" | "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "TRIMESTER";
type Channel = "EMAIL" | "SMS" | "BOTH";

const CADENCE_LABEL: Record<
  "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "TRIMESTER",
  string
> = {
  WEEKLY: "every week",
  BIWEEKLY: "every two weeks",
  MONTHLY: "every month",
  TRIMESTER: "every three months",
};

/** `isNewSelection`: true when this cadence differs from what's already
 *  saved — matches updateProfile's own "send one now" condition, so the
 *  copy here doesn't promise something the save won't actually do. */
function digestNote(cadence: Cadence, channel: Channel, isNewSelection: boolean): string {
  if (cadence === "OFF") return "No digest emails.";
  const how =
    channel === "EMAIL"
      ? "by email"
      : channel === "SMS"
        ? "by text once carrier approval completes — by email until then"
        : "by email now, and by text too once carrier approval completes";
  const lead = isNewSelection
    ? "You'll get one right away (unless you've had one in the last 24 hours), then "
    : "Sent ";
  return `${lead}${CADENCE_LABEL[cadence]} ${how}.`;
}

function applyThemePreview(theme: ThemeKey) {
  document.documentElement.dataset.theme = theme;
}

type NeighbornetOption = { id: string; name: string; region: string; subArea: string | null };

export function ProfileForm({
  name,
  image,
  phone,
  theme,
  digestCadence,
  notificationChannel,
  smsConsent,
  homeSubArea,
  digestSubAreas,
  regionMap,
  representingNeighbornetId,
  neighbornetOptions,
  alertOnNewFeedback = true,
  isCoordinator = false,
}: {
  name: string;
  image: string | null;
  phone: string | null;
  theme: string;
  digestCadence: Cadence;
  notificationChannel: Channel;
  smsConsent: boolean;
  homeRegion: string | null;
  homeSubArea: string | null;
  digestSubAreas: string[];
  regionMap: RegionMap;
  representingNeighbornetId: string | null;
  neighbornetOptions: NeighbornetOption[];
  alertOnNewFeedback?: boolean;
  /** Coordinators get their own neighbornet emails instead of the QC digest. */
  isCoordinator?: boolean;
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
  // One sub-region drives both the home location and the "Representing" list.
  const [homeArea, setHomeArea] = useState(homeSubArea ?? "");
  const [subAreaPicks, setSubAreaPicks] = useState<Set<string>>(new Set(digestSubAreas));
  const [representingId, setRepresentingId] = useState(representingNeighbornetId ?? "");

  const regionOfSubArea = useMemo(
    () => new Map(flattenRegionMap(regionMap).map((r) => [r.subArea, r.region])),
    [regionMap],
  );
  const homeRegionValue = homeArea ? (regionOfSubArea.get(homeArea) ?? "") : "";

  // Once a sub-region is chosen, only its neighbornets are offered — plus the
  // current pick, so an older out-of-region choice doesn't silently vanish.
  const representingOptions = homeArea
    ? neighbornetOptions.filter((n) => n.subArea === homeArea || n.id === representingId)
    : neighbornetOptions;

  function changeHomeArea(value: string) {
    const parsed = parseArea(value);
    const sub = parsed.kind === "sub" ? parsed.subArea : "";
    setHomeArea(sub);
    if (sub) {
      const current = neighbornetOptions.find((n) => n.id === representingId);
      if (current && current.subArea !== sub) setRepresentingId("");
    }
  }

  // Works the other way too: picking a neighbornet moves the sub-region to it.
  function changeRepresenting(id: string) {
    setRepresentingId(id);
    const nn = neighbornetOptions.find((n) => n.id === id);
    if (nn?.subArea) setHomeArea(nn.subArea);
  }

  const neighbornetGroups = useMemo(() => {
    const byGroup = new Map<string, NeighbornetOption[]>();
    for (const n of representingOptions) {
      const key = n.subArea ? `${n.region} — ${n.subArea}` : n.region;
      const list = byGroup.get(key) ?? [];
      list.push(n);
      byGroup.set(key, list);
    }
    return [...byGroup.entries()];
  }, [representingOptions]);

  function toggleSubArea(subArea: string) {
    setSubAreaPicks((prev) => {
      const next = new Set(prev);
      if (next.has(subArea)) next.delete(subArea);
      else next.add(subArea);
      return next;
    });
  }

  function setManySubAreas(values: string[], checked: boolean) {
    setSubAreaPicks((prev) => {
      const next = new Set(prev);
      for (const v of values) {
        if (checked) next.add(v);
        else next.delete(v);
      }
      return next;
    });
  }

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

      {!isCoordinator && (
      <>
      <div className="field">
        <label htmlFor="home-area">
          Home sub-region <span className="optional-tag">optional</span>
        </label>
        <SubRegionSelect
          id="home-area"
          regionMap={regionMap}
          value={homeArea ? subValue(homeArea) : ""}
          onChange={changeHomeArea}
          emptyLabel="Choose your sub-region…"
        />
        <input type="hidden" name="homeSubArea" value={homeArea} />
        <input type="hidden" name="homeRegion" value={homeRegionValue} />
        <div className="survey-time-note">
          Where you&rsquo;re from — this is the default for which
          neighbornets your digest covers, below, and where the feedback form
          and Neighbornets page start.
        </div>
      </div>

      <div className="field">
        <label htmlFor="representing">
          Representing <span className="optional-tag">optional</span>
        </label>
        <select
          id="representing"
          name="representingNeighbornetId"
          value={representingId}
          onChange={(e) => changeRepresenting(e.target.value)}
        >
          <option value="">No neighbornet chosen</option>
          {homeArea
            ? representingOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))
            : neighbornetGroups.map(([groupLabel, options]) => (
                <optgroup key={groupLabel} label={groupLabel}>
                  {options.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </optgroup>
              ))}
        </select>
        <div className="survey-time-note">
          {homeArea
            ? `Showing neighbornets in ${homeArea}. `
            : "Pick a sub-region above to narrow this list — or pick a neighbornet and your sub-region fills in. "}
          Shown next to your name on the Cloud Team leaderboard.
        </div>
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
              </span>
              <div className="toggle-option-desc">
                Requires a phone number and consent below. Texts start once
                carrier approval completes — set your preference now.
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
              </span>
              <div className="toggle-option-desc">
                Email now, text too once carrier approval completes.
              </div>
            </span>
          </label>
        </div>
      </div>

      {/* Carries the same wording as the public opt-in form, because this is
          the other place consent can be given and the two have to be
          equivalent — a thinner version here would be the weakest link in
          the consent record. */}
      <div className="field">
        <label className="toggle-option" style={{ alignItems: "flex-start" }}>
          <input
            type="checkbox"
            name="smsConsent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span className="toggle-option-desc">{SMS_CONSENT_TEXT}</span>
        </label>
        <div className="sms-disclosures">
          <div>{SMS_FREQUENCY_LINE}</div>
          <div>{SMS_RATES_LINE}</div>
          <div>{SMS_HELP_STOP_LINE}</div>
          <div>{SMS_NO_MARKETING_LINE}</div>
          <div style={{ marginTop: 6 }}>
            <a href="/terms" target="_blank" rel="noreferrer">
              Terms of Service
            </a>
            {" | "}
            <a href="/privacy" target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
          </div>
        </div>
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
                ["TRIMESTER", "Every 3 months"],
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
          <div className="survey-time-note" style={{ marginTop: 10, marginBottom: 14 }}>
            {digestNote(cadence, effectiveChannel, cadence !== digestCadence)}
          </div>

          <label style={{ display: "block", marginBottom: 8 }}>
            Which areas <span className="optional-tag">optional</span>
          </label>
          <AreaMultiSelect
            regionMap={regionMap}
            selected={subAreaPicks}
            onToggle={toggleSubArea}
            onSetMany={setManySubAreas}
            fieldName="digestSubAreas"
          />
          <div className="survey-time-note" style={{ marginTop: 10 }}>
            Leave everything unchecked to automatically follow your home
            location above. Check specific areas here instead to follow a
            custom set — e.g. your home area plus a few others you help
            oversee.
          </div>
        </div>
      </div>

      </>
      )}

      {/* Coordinators get their own two emails rather than the QC digest:
          a periodic summary of their own neighbornet, and an alert the
          moment new feedback lands. No area picker — their scope is
          already whatever they look after. */}
      {isCoordinator && (
        <div className="field">
          <label>Emails about your neighbornet</label>
          <div className="subpanel">
            <div className="status-options">
              {(
                [
                  ["OFF", "Off"],
                  ["WEEKLY", "Weekly"],
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
            <div className="survey-time-note" style={{ marginTop: 10, marginBottom: 14 }}>
              {cadence === "OFF" ? (
                "No summary emails."
              ) : (
                <>
                  Sent weekly, but each one covers{" "}
                  <strong>the whole trimester so far</strong> — not just the
                  last seven days. So you get a regular reminder, and the
                  full picture of the term every time, rather than having to
                  stitch the weeks together yourself.
                </>
              )}
            </div>

            <label
              style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                name="alertOnNewFeedback"
                defaultChecked={alertOnNewFeedback}
              />
              Email me as soon as new feedback lands
            </label>
            <div className="survey-time-note" style={{ marginTop: 8 }}>
              Separate from the summary above — one email per visit, as it
              happens. Texts aren&rsquo;t wired up yet, so these go by email.
            </div>
          </div>
        </div>
      )}

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
