import { db } from "@/lib/db";
import { PageHead } from "@/components/PageHead";
import { initials } from "@/lib/format";

export default async function TeamPage() {
  const members = await db.user.findMany({
    where: { status: "APPROVED" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });

  return (
    <>
      <PageHead
        title="Cloud Team"
        desc="Every approved Cloud member and the status of their visits."
      />
      <div className="card">
        <div className="section-label">All members</div>
        <div className="nn-select-list">
          {members.map((m) => {
            const display = m.name || m.email || "Member";
            return (
              <div key={m.id} className="nn-select-item">
                <div className="member-select-item">
                  <div className="avatar-circle">{initials(display)}</div>
                  <div>
                    <div className="nsi-name">{display}</div>
                    <div className="nsi-city">
                      {m.role === "ADMIN" ? "Admin" : "Member"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
