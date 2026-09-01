"use client";

import { useActionState } from "react";

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

  return (
    <form action={formAction}>
      {state.error && <div className="auth-msg error">{state.error}</div>}
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
          label="Region"
          placeholder="e.g. Northeast"
          required
          defaultValue={initial?.region ?? ""}
          error={fe.region}
        />
        <Field
          name="subArea"
          label="Sub-area"
          optional="optional"
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
