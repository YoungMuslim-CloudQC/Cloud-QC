"use client";

import { useActionState } from "react";

import {
  addNeighbornet,
  type AddNeighbornetState,
} from "@/server/actions/neighbornets";

const INITIAL: AddNeighbornetState = {};

function Field({
  name,
  label,
  optional,
  placeholder,
  error,
  ...rest
}: {
  name: string;
  label: string;
  optional?: string;
  placeholder?: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={`nn-${name}`}>
        {label}{" "}
        {optional && <span className="optional-tag">{optional}</span>}
      </label>
      <input id={`nn-${name}`} name={name} placeholder={placeholder} {...rest} />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export function AddNeighbornetForm() {
  const [state, formAction, pending] = useActionState(addNeighbornet, INITIAL);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {state.error && <div className="auth-msg error">{state.error}</div>}
      <div className="form-grid">
        <Field name="name" label="Name" placeholder="e.g. Paterson" required error={fe.name} />
        <Field name="city" label="City / area name" optional="optional" placeholder="e.g. Paterson, NJ" error={fe.city} />
        <Field name="region" label="Region" placeholder="e.g. Northeast" required error={fe.region} />
        <Field name="subArea" label="Sub-area" placeholder="e.g. North New Jersey" required error={fe.subArea} />
        <Field name="stateCode" label="State (2-letter)" optional="for the map" placeholder="NJ" maxLength={2} style={{ textTransform: "uppercase" }} error={fe.stateCode} />
        <Field name="latitude" label="Latitude" optional="for the map" placeholder="40.8976" error={fe.latitude} />
        <Field name="longitude" label="Longitude" optional="for the map" placeholder="-74.0154" error={fe.longitude} />
        <Field name="contactEmail" label="Contact email" optional="optional" placeholder="nnc.name@youngmuslims.com" error={fe.contactEmail} />
        <Field name="instagram" label="Instagram" optional="optional" placeholder="@ym.name.brothers" error={fe.instagram} />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "auto" }}
        disabled={pending}
      >
        {pending ? "Adding…" : "Add neighbornet"}
      </button>
    </form>
  );
}
