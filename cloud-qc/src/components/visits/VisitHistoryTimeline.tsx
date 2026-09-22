import { HISTORY_ACTION_META, type VisitSnapshot } from "@/lib/visit-history";
import { statusMeta } from "@/lib/format";

export type TimelineEntry = {
  id: string;
  action: string;
  performedAt: Date | string;
  performedByName: string;
  snapshot: VisitSnapshot;
};

function stamp(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.toISOString().slice(0, 10)} ${date
    .toISOString()
    .slice(11, 16)} UTC`;
}

function rating(n: number | null) {
  return n == null ? "—" : `${n}/5`;
}

function SnapshotFields({ s }: { s: VisitSnapshot }) {
  const meta = statusMeta(s.status);
  const nnLabel = s.neighbornetNames?.length
    ? s.neighbornetNames.join(", ")
    : s.neighbornetName || (s.subRegion ? `${s.subRegion} (sub-region event)` : "—");
  const rows: [string, React.ReactNode][] = [
    ["Neighbornet", nnLabel],
    ["Visit date", <span className="cell-mono" key="d">{s.visitDate}</span>],
    ["Submitter", s.submittedByName],
    [
      "Co-visitors",
      s.coVisitors.length ? s.coVisitors.map((c) => c.name).join(", ") : "—",
    ],
    ["Group size", s.groupSize ?? "—"],
    ["Avg age", s.avgAge ?? "—"],
    ["Food", rating(s.foodRating)],
    ["Leadership", rating(s.leadershipRating)],
    ["Halaqah", rating(s.halaqahRating)],
    [
      "Status",
      s.status ? (
        <span className={`badge ${meta.cls}`} key="s">
          {meta.label}
        </span>
      ) : (
        "—"
      ),
    ],
    ["Feedback sent", s.feedbackSent ? "Yes" : "No"],
  ];

  return (
    <div style={{ marginTop: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr",
          gap: "3px 14px",
          fontSize: 12,
        }}
      >
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}>
            <div style={{ color: "var(--text-muted)" }}>{k}</div>
            <div>{v}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          whiteSpace: "pre-wrap",
          color: "var(--text)",
          borderLeft: "2px solid var(--border)",
          paddingLeft: 10,
        }}
      >
        {s.notes || <span style={{ color: "var(--text-muted)" }}>(no notes)</span>}
      </div>
    </div>
  );
}

export function VisitHistoryTimeline({
  entries,
}: {
  entries: TimelineEntry[];
}) {
  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <strong>No history</strong>
        Changes to this visit will be recorded here.
      </div>
    );
  }

  return (
    <div
      style={{
        borderLeft: "2px solid var(--border)",
        marginLeft: 6,
        paddingLeft: 16,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      {entries.map((e) => {
        const meta = HISTORY_ACTION_META[e.action] ?? {
          label: e.action,
          cls: "badge-neutral",
        };
        return (
          <div key={e.id} style={{ position: "relative" }}>
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: -23,
                top: 3,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--primary)",
                boxShadow: "0 0 0 3px var(--surface)",
              }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span className={`badge ${meta.cls}`}>{meta.label}</span>
              <span style={{ fontSize: 12.5 }}>
                by <strong>{e.performedByName}</strong>
              </span>
              <span
                className="cell-mono"
                style={{ fontSize: 11.5, color: "var(--text-muted)" }}
              >
                {stamp(e.performedAt)}
              </span>
            </div>
            <details style={{ marginTop: 4 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: 11.5,
                  color: "var(--secondary)",
                }}
              >
                Snapshot at this point
              </summary>
              <SnapshotFields s={e.snapshot} />
            </details>
          </div>
        );
      })}
    </div>
  );
}
