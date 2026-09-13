import { ragColor } from "@/lib/format";

type OrbitNode = { id: string; name: string; status: string | null };

export function Orbit({ nodes }: { nodes: OrbitNode[] }) {
  const w = 320;
  const h = 220;
  const cx = w / 2;
  const cy = h / 2 + 6;
  const radius = 82;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      {nodes.map((n, i) => {
        const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return (
          <line
            key={`l-${n.id}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--border)"
            strokeWidth={1.4}
          />
        );
      })}
      <circle
        cx={cx}
        cy={cy}
        r={30}
        fill="var(--primary)"
        style={{ filter: "drop-shadow(0 0 10px rgba(var(--primary-rgb), 0.7))" }}
      />
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontFamily="var(--font-display), sans-serif"
        fontSize={11}
        fill="var(--on-primary)"
        fontWeight={600}
      >
        Cloud
      </text>
      {nodes.map((n, i) => {
        const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        const short = n.name.length > 10 ? `${n.name.slice(0, 9)}…` : n.name;
        return (
          <g key={`n-${n.id}`}>
            <circle cx={x} cy={y} r={16} fill={ragColor(n.status)} />
            <text
              x={x}
              y={y + 30}
              textAnchor="middle"
              fontFamily="var(--font-body), sans-serif"
              fontSize={9.5}
              fill="var(--text-muted)"
            >
              {short}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
