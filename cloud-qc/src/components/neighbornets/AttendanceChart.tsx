export function AttendanceChart({
  points,
}: {
  points: { date: string; value: number }[];
}) {
  if (points.length === 0) return null;
  const recent = points.slice(-8);
  const max = Math.max(...recent.map((p) => p.value), 1);

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}
      >
        Attendance trend
      </div>
      <div className="bar-chart">
        {recent.map((p, i) => (
          <div
            key={`${p.date}-${i}`}
            className="bar"
            style={{ height: `${Math.max(4, (p.value / max) * 80)}px` }}
            title={`${p.date}: ${p.value}`}
          />
        ))}
      </div>
      <div className="bar-labels">
        {recent.map((p, i) => (
          <span key={`${p.date}-${i}`}>{p.date.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}
