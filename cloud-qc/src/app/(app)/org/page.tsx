import { requireApprovedAny } from "@/lib/authz";
import { getOrgChart, type OrgPerson } from "@/lib/org-chart";
import { PageHead } from "@/components/PageHead";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

function Person({
  p,
  role,
  note,
}: {
  p: OrgPerson;
  role?: string;
  note?: string;
}) {
  return (
    <div className="org-person">
      <Avatar name={p.name} image={p.image} />
      <div style={{ minWidth: 0 }}>
        <div className="org-person-name">
          {p.name}
          {p.pending && (
            <span className="badge badge-warn" style={{ marginLeft: 6 }}>
              Awaiting approval
            </span>
          )}
        </div>
        <div className="org-person-sub">{role ?? p.email}</div>
        {note && <div className="org-person-sub">{note}</div>}
      </div>
    </div>
  );
}

/** The internal org map: who looks after which neighbornet, who runs each
 *  sub-region, who's on whose core team, and who's on the Cloud QC team.
 *  Structure only — no feedback — so everyone approved sees the same thing. */
export default async function OrgPage() {
  await requireApprovedAny();
  const { subregions, cloudTeam } = await getOrgChart();

  const staffed = subregions.filter(
    (s) => s.srCoordinators.length > 0 || s.coordinators.length > 0,
  );
  const empty = subregions.filter(
    (s) => s.srCoordinators.length === 0 && s.coordinators.length === 0,
  );

  return (
    <>
      <PageHead
        title="Org map"
        desc="Who looks after what — sub-regions, their coordinators, and the core teams under them."
      />

      {staffed.length === 0 ? (
        <div className="card" style={{ maxWidth: 640, marginBottom: 20 }}>
          <div className="empty-state">
            <strong>Nobody assigned yet</strong>
            Once an admin links coordinators to neighbornets, the structure
            shows up here.
          </div>
        </div>
      ) : (
        staffed.map((s) => (
          <div className="card org-sub" key={s.subArea}>
            <div className="section-label">
              <span>
                {s.subArea}
                {s.region && s.region !== s.subArea && (
                  <span className="optional-tag"> · {s.region}</span>
                )}
              </span>
              <span className="survey-time-note">
                {s.coordinators.length}{" "}
                {s.coordinators.length === 1 ? "coordinator" : "coordinators"}
              </span>
            </div>

            {s.srCoordinators.length > 0 && (
              <div className="org-src">
                {s.srCoordinators.map((src) => (
                  <div key={src.id}>
                    <Person p={src} role={`SR coordinator · ${s.subArea}`} />
                    {src.coreTeam.length > 0 && (
                      <div className="org-core">
                        <div className="org-core-label">Their core team</div>
                        {src.coreTeam.map((m) => (
                          <Person key={m.id} p={m} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="org-coord-grid">
              {s.coordinators.map((c) => (
                <div className="org-coord" key={`${c.id}-${c.neighbornetId}`}>
                  <div className="org-coord-nn">
                    {c.neighbornetName}
                    {c.handingOver && (
                      <span className="badge badge-event" style={{ marginLeft: 6 }}>
                        Handover
                      </span>
                    )}
                  </div>
                  <Person p={c} role="Coordinator" />
                  {c.coreTeam.length > 0 ? (
                    <div className="org-core">
                      <div className="org-core-label">
                        Core team · {c.coreTeam.length}
                      </div>
                      {c.coreTeam.map((m) => (
                        <Person key={m.id} p={m} />
                      ))}
                    </div>
                  ) : (
                    <div className="org-core-label" style={{ marginTop: 8 }}>
                      No core team yet
                    </div>
                  )}
                </div>
              ))}
            </div>

            {s.uncovered.length > 0 && (
              <div className="survey-time-note" style={{ marginTop: 12 }}>
                No coordinator yet: {s.uncovered.join(", ")}
              </div>
            )}
          </div>
        ))
      )}

      {empty.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-label">
            <span>Sub-regions with nobody assigned</span>
            <span className="survey-time-note">{empty.length}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
            {empty.map((s) => s.subArea).join(" · ")}
          </div>
        </div>
      )}

      <div className="card">
        <div className="section-label">
          <span>Cloud QC team</span>
          <span className="survey-time-note">
            {cloudTeam.length} {cloudTeam.length === 1 ? "person" : "people"}
          </span>
        </div>
        <div className="org-coord-grid">
          {cloudTeam.map((m) => (
            <Person
              key={m.id}
              p={m}
              role={m.isAdmin ? "Admin" : "QC member"}
              note={`${m.visitCount} ${m.visitCount === 1 ? "visit" : "visits"} logged`}
            />
          ))}
        </div>
      </div>
    </>
  );
}
