import { useMemo } from "react";
import type { Field, GapView, Sub } from "../types";

interface Props {
  sub: Sub;
  world: Field;
  fieldById: Map<string, Field>;
  highlight: number | null;
  onOpenGap: (g: GapView) => void;
  onClose: () => void;
  onConcept: (id: number | null) => void;
}

/** The scroll that unrolls over an island, listing its research gaps. */
export default function Parchment({ sub, world, fieldById, highlight, onOpenGap, onClose, onConcept }: Props) {
  const gaps = useMemo(() => {
    if (highlight == null) return sub.gaps;
    const hit = (g: GapView) => g.a === highlight || g.b === highlight;
    return [...sub.gaps.filter(hit), ...sub.gaps.filter((g) => !hit(g))];
  }, [sub.gaps, highlight]);
  const top = gaps[0]?.score || 1;
  const color = (id: string) => fieldById.get(id)?.color ?? "#999";

  return (
    <div className="parchment" role="dialog" aria-label={`${sub.name} scroll`}>
      <div className="rod" aria-hidden="true" />
      <div className="parchment-paper" tabIndex={0}>
        <button className="parch-close" onClick={onClose} aria-label="Roll the scroll away">
          ×
        </button>
        <p className="parch-eyebrow">{world.name}</p>
        <h2 className="parch-title">{sub.name}</h2>
        <p className="parch-meta">
          {sub.concepts.length} concepts · {sub.gaps.length} research gaps
        </p>
        <div className="parch-rule" aria-hidden="true" />

        <h3>Research gaps from this island</h3>
        {gaps.length === 0 ? (
          <p className="parch-empty">No forecast gaps start here yet. Sail on to the next island.</p>
        ) : (
          <ol className="parch-gaps">
            {gaps.map((g, i) => (
              <li key={g.key}>
                <button onClick={() => onOpenGap(g)} className={highlight != null && (g.a === highlight || g.b === highlight) ? "hit" : ""}>
                  <span className="parch-rank">{i + 1}</span>
                  <span className="parch-pair">
                    <span>
                      <i style={{ background: color(g.ca.field) }} />
                      {g.ca.name}
                    </span>
                    <span className="parch-x">×</span>
                    <span>
                      <i style={{ background: color(g.cb.field) }} />
                      {g.cb.name}
                    </span>
                    <span className="parch-bar">
                      <span style={{ width: `${Math.max(6, (g.score / top) * 100)}%` }} />
                    </span>
                  </span>
                  <span className="parch-score">{g.score.toFixed(2)}</span>
                </button>
              </li>
            ))}
          </ol>
        )}

        <h3>Concepts on this island</h3>
        <div className="parch-chips">
          {sub.concepts.slice(0, 80).map((c) => (
            <button
              key={c.id}
              className={`parch-chip ${highlight === c.id ? "on" : ""}`}
              onClick={() => onConcept(highlight === c.id ? null : c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <p className="parch-end">~ scroll up to roll it away ~</p>
      </div>
      <div className="rod" aria-hidden="true" />
    </div>
  );
}
