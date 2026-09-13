"use client";

import { useActionState } from "react";

import {
  adminUpdateMemberProfile,
  type AdminProfileState,
} from "@/server/actions/admin";
import { Avatar } from "@/components/Avatar";

const INITIAL: AdminProfileState = {};

/** Admin-only "fix their profile" form — name, phone, photo. Shown on the
 *  member detail page next to their stats, not their personal preferences
 *  (theme/digest/notifications) which stay self-service only. */
export function AdminEditMemberProfile({
  userId,
  name,
  image,
  phone,
}: {
  userId: string;
  name: string;
  image: string | null;
  phone: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    adminUpdateMemberProfile,
    INITIAL,
  );

  return (
    <div className="subpanel">
      <div className="section-label" style={{ marginBottom: 10 }}>
        Edit profile <span className="tag-construction">Admin</span>
      </div>
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        {state.error && <div className="auth-msg error">{state.error}</div>}
        {state.ok && <div className="auth-msg info">Saved.</div>}

        <div className="profile-photo-row">
          <Avatar name={name} image={image} />
          <div>
            <label htmlFor={`photo-${userId}`}>Photo</label>
            <input
              id={`photo-${userId}`}
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label htmlFor={`name-${userId}`}>Name</label>
            <input id={`name-${userId}`} name="name" type="text" defaultValue={name} required />
          </div>
          <div className="field">
            <label htmlFor={`phone-${userId}`}>
              Phone number <span className="optional-tag">optional</span>
            </label>
            <input
              id={`phone-${userId}`}
              name="phone"
              type="tel"
              defaultValue={phone ?? ""}
              placeholder="e.g. (555) 123-4567"
            />
          </div>
        </div>

        <button
          className="btn btn-secondary btn-small"
          type="submit"
          disabled={pending}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
