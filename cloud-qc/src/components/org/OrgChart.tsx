"use client";

import { useMemo, useState } from "react";

import { Avatar } from "@/components/Avatar";

export type OrgNode = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** "SR coordinator", "Coordinator", "Core team", "QC member", "Admin" */
  title: string;
  /** Teaneck, NJ North — what they're responsible for. */
  scope: string | null;
  pending: boolean;
  reportsTo: { name: string; title: string } | null;
  directReports: { id: string; name: string; image: string | null }[];
  facts: { label: string; value: string }[];
};

/** One branch: an SR coordinator over a sub-region's coordinators, or a
 *  coordinator over their core team. */
export type OrgBranch = {
  key: string;
  heading: string;
  subheading: string | null;
  /** Top of the chain, if the sub-region has an SRC. */
  lead: OrgNode | null;
  /** The row beneath — coordinators, each with their own core team. */
  members: { node: OrgNode; children: OrgNode[] }[];
  gaps: string[];
};

function Card({
  node,
  onOpen,
  selected,
  compact,
}: {
  node: OrgNode;
  onOpen: (n: OrgNode) => void;
  selected: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={`orgc-card${selected ? " sel" : ""}${compact ? " compact" : ""}`}
      onClick={() => onOpen(node)}
    >
      <span className="orgc-card-text">
        <span className="orgc-card-name">{node.name}</span>
        <span className="orgc-card-title">
          {node.title}
          {node.scope ? ` · ${node.scope}` : ""}
        </span>
      </span>
      <Avatar name={node.name} image={node.image} />
      {node.pending && <span className="orgc-pending" title="Awaiting admin approval" />}
    </button>
  );
}

export function OrgChart({
  branches,
  cloudTeam,
}: {
  branches: OrgBranch[];
  cloudTeam: OrgNode[];
}) {
  const [open, setOpen] = useState<OrgNode | null>(null);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const matches = (n: OrgNode) =>
    !q ||
    n.name.toLowerCase().includes(q) ||
    n.email.toLowerCase().includes(q) ||
    (n.scope ?? "").toLowerCase().includes(q);

  const visible = useMemo(() => {
    if (!q) return branches;
    return branches
      .map((b) => ({
        ...b,
        lead: b.lead && matches(b.lead) ? b.lead : b.lead,
        members: b.members.filter(
          (m) => matches(m.node) || m.children.some(matches),
        ),
      }))
      .filter(
        (b) =>
          b.members.length > 0 ||
          (b.lead && matches(b.lead)) ||
          b.heading.toLowerCase().includes(q),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `matches` closes over q
  }, [branches, q]);

  const visibleCloud = cloudTeam.filter(matches);

  return (
    <div className="orgc">
      <input
        type="search"
        className="orgc-search"
        placeholder="Search by name, email or neighbornet…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="orgc-scroll">
        {visible.map((b) => (
          <section className="orgc-branch" key={b.key}>
            <header className="orgc-branch-head">
              <h2>{b.heading}</h2>
              {b.subheading && <span>{b.subheading}</span>}
            </header>

            {b.lead && (
              <div className="orgc-lead">
                <Card
                  node={b.lead}
                  onOpen={setOpen}
                  selected={open?.id === b.lead.id}
                />
                {b.members.length > 0 && <div className="orgc-stem" />}
              </div>
            )}

            {/* The joining rail only makes sense with siblings to join —
                with a single report the vertical stem says it already, so
                "railed" is only added past one. */}
            {b.members.length > 0 && (
              <div
                className={`orgc-row${b.lead ? " under" : ""}${
                  b.lead && b.members.length > 1 ? " railed" : ""
                }`}
              >
                {b.members.map(({ node, children }) => (
                  <div className="orgc-col" key={node.id + node.scope}>
                    <Card node={node} onOpen={setOpen} selected={open?.id === node.id} />
                    {children.length > 0 && (
                      <>
                        <div className="orgc-stem short" />
                        <div className="orgc-children">
                          {children.map((c) => (
                            <Card
                              key={c.id}
                              node={c}
                              onOpen={setOpen}
                              selected={open?.id === c.id}
                              compact
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {b.gaps.length > 0 && !q && (
              <div className="orgc-gaps">No coordinator: {b.gaps.join(", ")}</div>
            )}
          </section>
        ))}

        {visibleCloud.length > 0 && (
          <section className="orgc-branch">
            <header className="orgc-branch-head">
              <h2>Cloud QC team</h2>
              <span>{visibleCloud.length} people</span>
            </header>
            <div className="orgc-row wrap">
              {visibleCloud.map((n) => (
                <Card key={n.id} node={n} onOpen={setOpen} selected={open?.id === n.id} compact />
              ))}
            </div>
          </section>
        )}

        {visible.length === 0 && visibleCloud.length === 0 && (
          <div className="empty-state">
            <strong>Nobody matches “{query}”</strong>
            Try a name, an email, or a neighbornet.
          </div>
        )}
      </div>

      {open && <ProfilePanel node={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ProfilePanel({ node, onClose }: { node: OrgNode; onClose: () => void }) {
  return (
    <>
      <div className="orgc-scrim" onClick={onClose} />
      <aside className="orgc-panel" role="dialog" aria-label={`About ${node.name}`}>
        <button type="button" className="orgc-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="orgc-panel-head">
          <Avatar name={node.name} image={node.image} />
          <div style={{ minWidth: 0 }}>
            <div className="orgc-panel-name">{node.name}</div>
            <div className="orgc-panel-title">
              {node.title}
              {node.scope ? ` · ${node.scope}` : ""}
            </div>
          </div>
        </div>

        {node.pending && (
          <div className="auth-msg error" style={{ marginBottom: 14 }}>
            This account is still waiting on admin approval.
          </div>
        )}

        <div className="orgc-panel-section">Contact</div>
        <a className="orgc-panel-link" href={`mailto:${node.email}`}>
          {node.email}
        </a>

        {node.facts.length > 0 && (
          <>
            <div className="orgc-panel-section">In Cloud QC</div>
            <dl className="orgc-facts">
              {node.facts.map((f) => (
                <div key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}

        {node.reportsTo && (
          <>
            <div className="orgc-panel-section">Reports to</div>
            <div className="orgc-panel-title">
              {node.reportsTo.name} · {node.reportsTo.title}
            </div>
          </>
        )}

        {node.directReports.length > 0 && (
          <>
            <div className="orgc-panel-section">
              Core team ({node.directReports.length})
            </div>
            <div className="orgc-reports">
              {node.directReports.map((r) => (
                <div className="orgc-report" key={r.id}>
                  <Avatar name={r.name} image={r.image} />
                  <span>{r.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
