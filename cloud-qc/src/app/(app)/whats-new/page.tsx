import { requireApprovedAny } from "@/lib/authz";
import { CHANGELOG } from "@/lib/changelog";
import { markCaughtUp } from "@/lib/changelog-read";
import { PageHead } from "@/components/PageHead";

export const dynamic = "force-dynamic";

/** Every release note, newest first. Opening the page counts as reading
 *  them, so the banner doesn't reappear afterwards. */
export default async function WhatsNewPage() {
  const me = await requireApprovedAny();
  // Opening the page counts as reading them, so the banner stays gone.
  if (!me.impersonating) await markCaughtUp(me.id);

  return (
    <>
      <PageHead title="What's new" desc="Everything that's changed in Cloud QC." />

      {CHANGELOG.map((r, i) => (
        <div className="card" key={r.id} style={{ maxWidth: 680, marginBottom: 14 }}>
          <div className="section-label">
            <span>
              {r.title}
              {i === 0 && (
                <span className="badge badge-event" style={{ marginLeft: 8 }}>
                  Latest
                </span>
              )}
            </span>
            <span className="survey-time-note">{r.date}</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 13.5,
              lineHeight: 1.65,
              color: "var(--text)",
            }}
          >
            {r.items.map((item) => (
              <li key={item} style={{ marginBottom: 4 }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
