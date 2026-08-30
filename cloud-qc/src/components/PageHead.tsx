export function PageHead({
  title,
  desc,
}: {
  title: string;
  desc?: string;
}) {
  return (
    <div className="page-head">
      <div className="page-title">{title}</div>
      {desc && <div className="page-desc">{desc}</div>}
    </div>
  );
}

export function ComingSoon({ feature }: { feature: string }) {
  return (
    <div className="card">
      <div className="empty-state">
        <strong>{feature} is being rebuilt</strong>
        This screen from the prototype hasn&apos;t been wired to the database
        yet. The schema, auth, and app shell are in place.
      </div>
    </div>
  );
}
