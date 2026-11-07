import { useMemo, useState } from "react";
import { downloadText, gapsToCsv } from "../data";
import type { Dataset, Field, GapView } from "../types";

type Sort = "score" | "cn" | "growth";

interface Props {
  data: Dataset;
  gaps: GapView[];
  fieldById: Map<string, Field>;
  onOpenGap: (g: GapView) => void;
}

export default function GapsView({ data, gaps, fieldById, onOpenGap }: Props) {
  const [query, setQuery] = useState("");
  const [field, setField] = useState("all");
  const [cross, setCross] = useState(false);
  const [sort, setSort] = useState<Sort>("score");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = gaps.filter((g) => {
      if (field !== "all" && g.ca.field !== field && g.cb.field !== field) return false;
      if (cross && g.ca.field === g.cb.field) return false;
      if (!q) return true;
      return [g.ca.name, g.cb.name, ...g.bridgeConcepts.map((c) => c.name)].some((n) => n.toLowerCase().includes(q));
    });
    const key: Record<Sort, (g: GapView) => number> = { score: (g) => g.score, cn: (g) => g.cn, growth: (g) => g.growth };
    return [...out].sort((a, b) => key[sort](b) - key[sort](a));
  }, [gaps, query, field, cross, sort]);

  const color = (id: string) => fieldById.get(id)?.color ?? "#ccc";
  const name = (id: string) => fieldById.get(id)?.name ?? id;

  return (
    <section className="page">
      <header className="page-head">
        <p className="eyebrow">For PhD students and research leads</p>
        <h1>Open research gaps</h1>
        <p className="lead">
          Pairs of concepts that have never appeared in the same abstract up to {data.meta.data_end}, ranked by how likely
          the model thinks they are to meet in {data.meta.horizon}. Early, well-connected gaps make strong thesis topics.
        </p>
      </header>

      <div className="toolbar">
        <label className="search">
          <span className="sr-only">Search concepts</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input type="search" placeholder="Search a concept, e.g. sepsis or volatility" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="select">
          <span className="sr-only">Field</span>
          <select value={field} onChange={(e) => setField(e.target.value)}>
            <option value="all">All fields</option>
            {data.fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <label className="select">
          <span className="sr-only">Sort by</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="score">Sort: forecast score</option>
            <option value="cn">Sort: shared neighbours</option>
            <option value="growth">Sort: recent growth</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={cross} onChange={(e) => setCross(e.target.checked)} />
          Cross-field only
        </label>
        <button
          className="btn"
          disabled={!list.length}
          onClick={() => downloadText("frontier-gaps.csv", gapsToCsv(list, name))}
        >
          Export CSV
        </button>
      </div>

      <p className="muted small">
        {list.length} of {gaps.length} forecasts
      </p>

      {list.length === 0 ? (
        <div className="empty">No gaps match. Try clearing the search or picking another field.</div>
      ) : (
        <ul className="gap-grid">
          {list.map((g) => (
            <li key={g.key}>
              <button className="gap-card" onClick={() => onOpenGap(g)}>
                <span className="gap-top">
                  <span className="rank mono">#{g.rank}</span>
                  {g.ca.field !== g.cb.field && <span className="chip accent">cross-field</span>}
                  <span className="score mono">{g.score.toFixed(2)}</span>
                </span>
                <span className="gap-pair">
                  <span>
                    <span className="dot" style={{ background: color(g.ca.field) }} />
                    {g.ca.name}
                  </span>
                  <span className="x">×</span>
                  <span>
                    <span className="dot" style={{ background: color(g.cb.field) }} />
                    {g.cb.name}
                  </span>
                </span>
                <span className="meter" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, g.score * 100)}%` }} />
                </span>
                <span className="muted small">
                  via {g.bridgeConcepts.map((c) => c.name).join(", ") || "indirect links"}
                </span>
                <span className="gap-foot small">
                  <span>{g.cn} shared neighbours</span>
                  {g.growth > 0 && <span className="trend">▲ {g.growth} recent links</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
