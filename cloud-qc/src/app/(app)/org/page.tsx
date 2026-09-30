import { requireApprovedAny } from "@/lib/authz";
import { getOrgChart } from "@/lib/org-chart";
import { PageHead } from "@/components/PageHead";
import { OrgChart, type OrgBranch, type OrgNode } from "@/components/org/OrgChart";

export const dynamic = "force-dynamic";

/** The internal org map: who looks after which neighbornet, who runs each
 *  sub-region, and who's on whose core team — laid out as a reporting tree
 *  you can click into. Structure only, no feedback, so anyone approved can
 *  read it. */
export default async function OrgPage() {
  await requireApprovedAny();
  const { subregions, cloudTeam } = await getOrgChart();

  const branches: OrgBranch[] = subregions
    .filter((s) => s.srCoordinators.length > 0 || s.coordinators.length > 0)
    .map((s) => {
      const lead = s.srCoordinators[0];
      const leadNode: OrgNode | null = lead
        ? {
            id: lead.id,
            name: lead.name,
            email: lead.email,
            image: lead.image,
            title: "SR coordinator",
            scope: s.subArea,
            pending: lead.pending,
            reportsTo: null,
            directReports: lead.coreTeam.map((m) => ({
              id: m.id,
              name: m.name,
              image: m.image,
            })),
            facts: [
              { label: "Sub-region", value: s.subArea },
              {
                label: "Neighbornets",
                value: `${s.coordinators.length} with a coordinator`,
              },
              { label: "Core team", value: `${lead.coreTeam.length}` },
            ],
          }
        : null;

      return {
        key: s.subArea,
        heading: s.subArea,
        subheading: s.region && s.region !== s.subArea ? s.region : null,
        lead: leadNode,
        members: s.coordinators.map((c) => ({
          node: {
            id: c.id,
            name: c.name,
            email: c.email,
            image: c.image,
            title: c.handingOver ? "Coordinator (handover)" : "Coordinator",
            scope: c.neighbornetName,
            pending: c.pending,
            reportsTo: lead
              ? { name: lead.name, title: "SR coordinator" }
              : null,
            directReports: c.coreTeam.map((m) => ({
              id: m.id,
              name: m.name,
              image: m.image,
            })),
            facts: [
              { label: "Neighbornet", value: c.neighbornetName },
              { label: "Sub-region", value: s.subArea },
              { label: "Core team", value: `${c.coreTeam.length}` },
            ],
          } satisfies OrgNode,
          children: c.coreTeam.map(
            (m) =>
              ({
                id: m.id,
                name: m.name,
                email: m.email,
                image: m.image,
                title: "Core team",
                scope: c.neighbornetName,
                pending: m.pending,
                reportsTo: { name: c.name, title: "Coordinator" },
                directReports: [],
                facts: [
                  { label: "Sees", value: `${c.neighbornetName}'s feedback` },
                  { label: "Through", value: c.name },
                ],
              }) satisfies OrgNode,
          ),
        })),
        gaps: s.uncovered,
      };
    });

  const cloud: OrgNode[] = cloudTeam.map((m) => ({
    id: m.id,
    name: m.name,
    email: m.email,
    image: m.image,
    title: m.isAdmin ? "Admin" : "QC member",
    scope: null,
    pending: false,
    reportsTo: null,
    directReports: [],
    facts: [
      { label: "Visits logged", value: `${m.visitCount}` },
      { label: "Role", value: m.isAdmin ? "Admin" : "QC member" },
    ],
  }));

  const unstaffed = subregions.filter(
    (s) => s.srCoordinators.length === 0 && s.coordinators.length === 0,
  );

  return (
    <>
      <PageHead
        title="Org map"
        desc="Who looks after what. Click anyone to see their details."
      />

      <OrgChart branches={branches} cloudTeam={cloud} />

      {unstaffed.length > 0 && (
        <div className="card" style={{ marginTop: 18 }}>
          <div className="section-label">
            <span>Sub-regions with nobody assigned</span>
            <span className="survey-time-note">{unstaffed.length}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
            {unstaffed.map((s) => s.subArea).join(" · ")}
          </div>
        </div>
      )}
    </>
  );
}
