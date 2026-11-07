import { useEffect, useMemo, useRef } from "react";
import { touchesField } from "../data";
import type { Field, GapView } from "../types";

export type Board = "medicine" | "quant";

const BOARDS: { id: Board; label: string }[] = [
  { id: "medicine", label: "Medicine" },
  { id: "quant", label: "Quant" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  board: Board;
  onBoard: (b: Board) => void;
  gaps: GapView[];
  fieldById: Map<string, Field>;
  horizon: string;
  onOpenGap: (g: GapView) => void;
  activeKey: string | null;
}

export default function Leaderboard({ open, onClose, board, onBoard, gaps, fieldById, horizon, onOpenGap, activeKey }: Props) {
  const rows = useMemo(() => gaps.filter((g) => touchesField(g, board)).slice(0, 20), [gaps, board]);
  const top = rows[0]?.score || 1;
  const color = (id: string) => fieldById.get(id)?.color ?? "#ccc";
  const ref = useRef<HTMLElement>(null);

  // A closed drawer must not be reachable with Tab or screen readers.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) el.removeAttribute("inert");
    else el.setAttribute("inert", "");
  }, [open]);

  return (
    <aside id="leaderboard" className={`leaderboard ${open ? "open" : ""}`} aria-label="Upcoming research gaps leaderboard" ref={ref}>
      <div className="lb-head">
        <div>
          <h2>Upcoming gaps</h2>
          <p className="muted small">Concept pairs most likely to meet {horizon ? `in ${horizon}` : "soon"}</p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close leaderboard">
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="seg" role="tablist" aria-label="Leaderboard field">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            role="tab"
            aria-selected={board === b.id}
            className={`seg-btn ${board === b.id ? "active" : ""}`}
            onClick={() => onBoard(b.id)}
            style={board === b.id ? { borderColor: color(b.id), color: color(b.id) } : undefined}
          >
            {b.label}
            <span className="seg-count">{gaps.filter((g) => touchesField(g, b.id)).length}</span>
          </button>
        ))}
      </div>

      <ol className="lb-list" role="tabpanel">
        {rows.length === 0 && <li className="muted lb-empty">No forecasts touch this field in the current data.</li>}
        {rows.map((g, i) => (
          <li key={g.key}>
            <button className={`lb-row ${activeKey === g.key ? "active" : ""}`} onClick={() => onOpenGap(g)}>
              <span className={`lb-rank ${i < 3 ? "podium" : ""}`}>{i + 1}</span>
              <span className="lb-body">
                <span className="lb-pair">
                  <span className="dot" style={{ background: color(g.ca.field) }} />
                  {g.ca.name}
                </span>
                <span className="lb-pair">
                  <span className="dot" style={{ background: color(g.cb.field) }} />
                  {g.cb.name}
                </span>
                <span className="lb-bar" aria-hidden="true">
                  <span style={{ width: `${Math.max(4, (g.score / top) * 100)}%` }} />
                </span>
              </span>
              <span className="lb-meta">
                <span className="mono">{g.score.toFixed(2)}</span>
                <span className="muted small" title="Shared neighbouring concepts">
                  {g.cn} links
                </span>
                {g.growth > 0 && (
                  <span className="trend" title="Recent growth in links around these concepts">
                    ▲ {g.growth}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="lb-foot muted small">
        Score = model probability of a first co-mention. Ranked within all forecasts that touch {board === "medicine" ? "medicine & biology" : "quantitative finance"}.
      </p>
    </aside>
  );
}
