import Link from "next/link";

import { db } from "@/lib/db";
import { requireNationalRollup } from "@/lib/authz";
import { hysteresisStatus } from "@/lib/neighbornet-status";
import { statusMeta } from "@/lib/format";
import { PageHead } from "@/components/PageHead";
import { BackLink } from "@/components/BackLink";

export const dynamic = "force-dynamic";

function avg(nums: (number | null)[]): string {
  const v = nums.filter((n): n is number => n != null);
  if (!v.length) return "—";
  return (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1);
}

/**
 * The national picture for an SR coordinator: every neighbornet's rolled-up
 * status and rating averages, anywhere in the country — but never the
 * written feedback, which stays with whoever runs that sub-region.
 *
 * Status comes from the same hysteresisStatus() the rest of the app uses,
 * over the same credit-bearing visitLinks, so joint events and any visit
 * tagged to several neighbornets count here exactly as they do everywhere
 * else rather than being silently dropped.
 */
export default async function NationalRollupPage() {
  const user = await requireNationalRollup();
  const mine = new Set(user.scope.fullSubregions);

  const nns = await db.neighbornet.findMany({
    where: { archivedAt: null },
    orderBy: [{ subArea: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      subArea: true,
      stage: true,
      visitLinks: {
        where: { visit: { deletedAt: null } },
        orderBy: { visit: { visitDate: "asc" } },
        select: {
          visit: {
            select: {
              visitDate: true,
              status: true,
              foodRating: true,
              leadershipRating: true,
              halaqahRating: true,
            },
          },
        },
      },
    },
  });

  const bySubArea = new Map<string, typeof nns>();
  for (const n of nns) {
    const key = n.subArea ?? "Unassigned";
    bySubArea.set(key, [...(bySubArea.get(key) ?? []), n]);
  }
  // The SRC's own sub-region(s) first — that's the one they answer for.
  const ordered = [...bySubArea.entries()].sort(([a], [b]) => {
    const am = mine.has(a) ? 0 : 1;
    const bm = mine.has(b) ? 0 : 1;
    return am !== bm ? am - bm : a.localeCompare(b);
  });

  return (
    <>
      <BackLink href="/coordinator" label="Feedback inbox" />
      <PageHead
        title="National rollup"
        desc="Status and rating averages for every neighbornet. Written feedback stays with the sub-region that owns it."
      />

      {ordered.map(([subArea, list]) => {
        const isMine = mine.has(subArea);
        const allVisits = list.flatMap((n) => n.visitLinks.map((l) => l.visit));
        return (
          <div className="card" key={subArea} style={{ marginBottom: 16 }}>
            <div className="section-label">
              <span>
                {subArea}
                {isMine && <span className="optional-tag"> · yours</span>}
              </span>
              <span className="survey-time-note">
                {list.length} NNs · {allVisits.length} visits
              </span>
            </div>

            <div className="table-mobile-cards">
              <table>
                <thead>
                  <tr>
                    <th>Neighbornet</th>
                    <th>Status</th>
                    <th>Food</th>
                    <th>Leadership</th>
                    <th>Halaqah</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((n) => {
                    const visits = n.visitLinks.map((l) => l.visit);
                    const status = hysteresisStatus(visits);
                    const meta = statusMeta(status);
                    return (
                      <tr key={n.id}>
                        <td data-label="Neighbornet">
                          {isMine ? (
                            <Link href={`/coordinator?nn=${n.id}`}>{n.name}</Link>
                          ) : (
                            n.name
                          )}
                          {n.stage === "EXPANSION" && (
                            <span className="badge badge-event" style={{ marginLeft: 6 }}>
                              Expansion
                            </span>
                          )}
                        </td>
                        <td data-label="Status">
                          {visits.length === 0 ? (
                            <span className="badge badge-neutral">No visits yet</span>
                          ) : (
                            <span className={`badge ${meta.cls}`}>{meta.label}</span>
                          )}
                        </td>
                        <td className="cell-mono" data-label="Food">
                          {avg(visits.map((v) => v.foodRating))}
                        </td>
                        <td className="cell-mono" data-label="Leadership">
                          {avg(visits.map((v) => v.leadershipRating))}
                        </td>
                        <td className="cell-mono" data-label="Halaqah">
                          {avg(visits.map((v) => v.halaqahRating))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
