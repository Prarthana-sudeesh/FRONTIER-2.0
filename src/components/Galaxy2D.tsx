import { useMemo, useState } from "react";
import { conceptSize } from "../data";
import type { GalaxyProps } from "./GalaxyView";

/** Flat top-down map of the galaxy. Used when WebGL is missing or on request. */
export default function Galaxy2D({ data, positions, fieldById, arcs, selected, onSelect, focus, highlight }: GalaxyProps) {
  const [hover, setHover] = useState<number | null>(null);

  const box = useMemo(() => {
    let m = 1;
    positions.forEach(([x, , z]) => (m = Math.max(m, Math.abs(x), Math.abs(z))));
    const pad = m * 1.12;
    return { pad, view: `${-pad} ${-pad} ${pad * 2} ${pad * 2}` };
  }, [positions]);

  const color = (field: string) => fieldById.get(field)?.color ?? "#ccc";
  const dim = (id: number) => highlight != null && !highlight.has(id);
  const byId = useMemo(() => new Map(data.concepts.map((c) => [c.id, c])), [data.concepts]);
  const labelled = new Set<number>([...(highlight ?? []), ...(hover != null ? [hover] : [])]);
  if (selected != null) labelled.add(selected);

  return (
    <svg className="galaxy-2d" viewBox={box.view} preserveAspectRatio="xMidYMid meet" role="img" aria-label="2D map of research concepts" onClick={() => onSelect(null)}>
      <defs>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="0" cy="0" r={box.pad * 0.35} fill="url(#core)" />
      <g fill="none">
        {arcs.map((g) => {
          const pa = positions.get(g.a);
          const pb = positions.get(g.b);
          if (!pa || !pb) return null;
          const mx = (pa[0] + pb[0]) / 2;
          const mz = (pa[2] + pb[2]) / 2;
          const on = focus?.key === g.key || (selected != null && (g.a === selected || g.b === selected));
          const off = highlight != null && !on;
          return (
            <path
              key={g.key}
              d={`M${pa[0]},${pa[2]} Q${mx * 0.6},${mz * 0.6} ${pb[0]},${pb[2]}`}
              stroke={on ? "#ffffff" : color(g.ca.field)}
              strokeOpacity={off ? 0.08 : on ? 0.95 : 0.35}
              strokeWidth={on ? 0.09 : 0.045}
              strokeDasharray="0.25 0.18"
            />
          );
        })}
      </g>
      {data.concepts.map((c) => {
        const p = positions.get(c.id);
        if (!p) return null;
        const r = conceptSize(c) * (c.id === selected ? 1.8 : 1.1);
        return (
          <circle
            key={c.id}
            cx={p[0]}
            cy={p[2]}
            r={r}
            fill={color(c.field)}
            opacity={dim(c.id) ? 0.18 : 1}
            className="star-2d"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(c.id === selected ? null : c.id);
            }}
            onMouseEnter={() => setHover(c.id)}
            onMouseLeave={() => setHover(null)}
          >
            <title>{c.name}</title>
          </circle>
        );
      })}
      {[...labelled].map((id) => {
        const c = byId.get(id);
        const p = positions.get(id);
        if (!c || !p) return null;
        return (
          <text key={`l${id}`} x={p[0] + 0.35} y={p[2] + 0.12} className="label-2d" fontSize={box.pad * 0.032}>
            {c.name}
          </text>
        );
      })}
    </svg>
  );
}
