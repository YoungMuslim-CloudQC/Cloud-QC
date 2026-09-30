import type { Impersonation } from "@/lib/authz";
import { stopViewAs } from "@/server/actions/view-as";

/** Always-visible reminder that this isn't the admin's own account. Fixed
 *  to the top rather than inline: an admin who forgets which account
 *  they're looking at is the main way this feature goes wrong, so it can't
 *  be scrolled away from. */
export function ViewAsBanner({ impersonating }: { impersonating: Impersonation }) {
  return (
    <div className="view-as-bar">
      <span>
        Viewing as <strong>{impersonating.viewingName}</strong>
        <span className="view-as-note"> · read-only, changes are blocked</span>
      </span>
      <form action={stopViewAs}>
        <button type="submit" className="view-as-stop">
          Stop viewing
        </button>
      </form>
    </div>
  );
}
