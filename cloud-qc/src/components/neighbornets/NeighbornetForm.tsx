"use client";

import { useActionState, useState } from "react";

import {
  addNeighbornet,
  updateNeighbornet,
  type NeighbornetFormState,
} from "@/server/actions/neighbornets";
import { LocationPicker } from "@/components/neighbornets/LocationPicker";

const INITIAL: NeighbornetFormState = {};

type Values = {
  id: string;
  name: string;
  city: string | null;
  region: string;
  subArea: string | null;
  stateCode: string | null;
  latitude: number | null;
  longitude: number | null;
  contactEmail: string | null;
  instagram: string | null;
  stage: "ACTIVE" | "EXPANSION";
  mediaLead: string | null;
  phone: string | null;
  driveUploads: boolean | null;
  postingConsistently: boolean | null;
  expansionComments: string | null;
};

function Field({
  name,
  label,
  optional,
  placeholder,
  error,
  defaultValue,
  ...rest
}: {
  name: string;
  label: string;
  optional?: string;
  placeholder?: string;
  error?: string;
  defaultValue?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={`nn-${name}`}>
        {label} {optional && <span className="optional-tag">{optional}</span>}
      </label>
      <input
        id={`nn-${name}`}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        {...rest}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function NeighbornetForm({
  mode,
  existingStates,
  initial,
}: {
  mode: "create" | "edit";
  existingStates: string[];
  initial?: Values;
}) {
  const action =
    mode === "edit" && initial
      ? updateNeighbornet.bind(null, initial.id)
      : addNeighbornet;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const fe = state.fieldErrors ?? {};
  const [stage, setStage] = useState<"ACTIVE" | "EXPANSION">(initial?.stage ?? "ACTIVE");

  return (
    <form action={formAction}>
      {state.error && <div className="auth-msg error">{state.error}</div>}

      <div className="field">
        <label htmlFor="nn-stage">Stage</label>
        <div className="status-options">
          <button
            type="button"
            className={`status-opt${stage === "ACTIVE" ? " sel-ok" : ""}`}
            onClick={() => setStage("ACTIVE")}
          >
            Active neighbornet
          </button>
          <button
            type="button"
            className={`status-opt${stage === "EXPANSION" ? " sel-ok" : ""}`}
            onClick={() => setStage("EXPANSION")}
          >
            Expansion / SR in training
          </button>
        </div>
        <input type="hidden" id="nn-stage" name="stage" value={stage} />
      </div>

      <div className="form-grid">
        <Field
          name="name"
          label="Name"
          placeholder="e.g. Paterson"
          required
          defaultValue={initial?.name ?? ""}
          error={fe.name}
        />
        <Field
          name="city"
          label="City / area name"
          optional="optional"
          placeholder="e.g. Paterson, NJ"
          defaultValue={initial?.city ?? ""}
          error={fe.city}
        />
        <Field
          name="region"
          label="State"
          placeholder="e.g. New Jersey"
          required
          defaultValue={initial?.region ?? ""}
          error={fe.region}
        />
        <Field
          name="subArea"
          label="Breakdown within state"
          optional="optional — only if the state is split"
          placeholder="e.g. North New Jersey"
          defaultValue={initial?.subArea ?? ""}
          error={fe.subArea}
        />
        <Field
          name="contactEmail"
          label="Contact email"
          optional="optional"
          placeholder="nnc.name@youngmuslims.com"
          defaultValue={initial?.contactEmail ?? ""}
          error={fe.contactEmail}
        />
        <Field
          name="instagram"
          label="Instagram"
          optional="optional"
          placeholder="@ym.name.brothers"
          defaultValue={initial?.instagram ?? ""}
          error={fe.instagram}
        />
      </div>

      {stage === "EXPANSION" && (
        <div className="form-grid" style={{ marginTop: 4 }}>
          <div className="section-label" style={{ gridColumn: "1 / -1" }}>
            <span>Expansion tracking</span>
          </div>
          <Field
            name="mediaLead"
            label="Media lead"
            optional="optional"
            placeholder="Who's running their socials"
            defaultValue={initial?.mediaLead ?? ""}
            error={fe.mediaLead}
          />
          <Field
            name="phone"
            label="Number"
            optional="optional"
            defaultValue={initial?.phone ?? ""}
            error={fe.phone}
          />
          <label
            className="field"
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <input
              type="checkbox"
              name="driveUploads"
              defaultChecked={initial?.driveUploads ?? false}
            />
            Uploading to the drive
          </label>
          <label
            className="field"
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <input
              type="checkbox"
              name="postingConsistently"
              defaultChecked={initial?.postingConsistently ?? false}
            />
            Posting consistently
          </label>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label htmlFor="nn-expansionComments">
              Comments <span className="optional-tag">optional</span>
            </label>
            <textarea
              id="nn-expansionComments"
              name="expansionComments"
              rows={3}
              defaultValue={initial?.expansionComments ?? ""}
            />
            {fe.expansionComments && (
              <span className="field-error">{fe.expansionComments}</span>
            )}
          </div>
        </div>
      )}

      <LocationPicker
        existingStates={existingStates}
        initial={
          initial
            ? {
                stateCode: initial.stateCode,
                latitude: initial.latitude,
                longitude: initial.longitude,
              }
            : undefined
        }
      />
      {(fe.stateCode || fe.latitude || fe.longitude) && (
        <div className="field-error" style={{ marginBottom: 12 }}>
          {fe.stateCode || fe.latitude || fe.longitude}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "auto" }}
        disabled={pending}
      >
        {pending
          ? "Saving…"
          : mode === "edit"
            ? "Save changes"
            : "Add neighbornet"}
      </button>
    </form>
  );
}
