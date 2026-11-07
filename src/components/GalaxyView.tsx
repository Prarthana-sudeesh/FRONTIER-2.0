import { lazy, Suspense, useMemo, useState } from "react";
import { hasWebGL } from "../data";
import type { Dataset, Field, GapView, Vec3 } from "../types";
import ErrorBoundary from "./ErrorBoundary";
import Galaxy2D from "./Galaxy2D";

const Galaxy3D = lazy(() => import("./Galaxy3D"));

const SHOWN_GAPS = 60;

export interface GalaxyProps {
  data: Dataset;
  positions: Map<number, Vec3>;
  fieldById: Map<string, Field>;
  arcs: GapView[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  focus: GapView | null;
  highlight: Set<number> | null;
}

interface Props {
  data: Dataset;
  gaps: GapView[];
  positions: Map<number, Vec3>;
  fieldById: Map<string, Field>;
  selected: number | null;
  onSelect: (id: number | null) => void;
  focusGap: string | null;
  onFocusGap: (key: string | null) => void;
  onOpenGap: (g: GapView) => void;
}

export default function GalaxyView({ data, gaps, positions, fieldById, selected, onSelect, focusGap, onFocusGap, onOpenGap }: Props) {
  const webgl = useMemo(hasWebGL, []);
  const [mode, setMode] = useState<"3d" | "2d">(webgl ? "3d" : "2d");
  const [failed, setFailed] = useState(false);
  const show3d = mode === "3d" && webgl && !failed;

  const focus = useMemo(() => gaps.find((g) => g.key === focusGap) ?? null, [gaps, focusGap]);
  const concept = selected == null ? null : data.concepts.find((c) => c.id === selected) ?? null;
  const conceptGaps = useMemo(
    () => (selected == null ? [] : gaps.filter((g) => g.a === selected || g.b === selected)),
    [gaps, selected],
  );

  const arcs = useMemo(() => {
    const list = gaps.slice(0, SHOWN_GAPS);
    for (const g of [...conceptGaps, ...(focus ? [focus] : [])]) if (!list.includes(g)) list.push(g);
    return list;
  }, [gaps, conceptGaps, focus]);

  const highlight = useMemo(() => {
    if (concept) return new Set([concept.id, ...conceptGaps.flatMap((g) => [g.a, g.b])]);
    if (focus) return new Set([focus.a, focus.b, ...focus.bridges]);
    return null;
  }, [concept, conceptGaps, focus]);

  const select = (id: number | null) => {
    onSelect(id);
    if (id != null) onFocusGap(null);
  };

  const props: GalaxyProps = { data, positions, fieldById, arcs, selected, onSelect: select, focus, highlight };
  const fallback = <Galaxy2D {...props} />;

  return (
    <section className="galaxy" aria-label="Concept galaxy">
      <div className="galaxy-canvas">
        {show3d ? (
          <ErrorBoundary fallback={fallback} onError={() => setFailed(true)}>
            <Suspense fallback={<div className="state"><div className="spinner" aria-hidden="true" /><p>Building 3D view…</p></div>}>
              <Galaxy3D {...props} />
            </Suspense>
          </ErrorBoundary>
        ) : (
          fallback
        )}
      </div>

      <div className="galaxy-hud top-left">
        <h1 className="hero-title">Where will research go next?</h1>
        <p className="hero-sub">
          Each star is a research concept. Arms are fields, older ideas sit near the core. Dashed arcs are{" "}
          <strong>forecast gaps</strong>: pairs never studied together that the model expects to meet in {data.meta.horizon}.
        </p>
        <ul className="legend">
          {data.fields.map((f) => (
            <li key={f.id}>
              <span className="dot" style={{ background: f.color }} />
              {f.name}
            </li>
          ))}
        </ul>
        <div className="seg small-seg" role="group" aria-label="View mode">
          <button className={`seg-btn ${show3d ? "active" : ""}`} onClick={() => { setFailed(false); setMode("3d"); }} disabled={!webgl} title={webgl ? "3D galaxy" : "WebGL is not available in this browser"}>
            3D
          </button>
          <button className={`seg-btn ${!show3d ? "active" : ""}`} onClick={() => setMode("2d")}>
            2D map
          </button>
        </div>
        {failed && <p className="muted small">3D failed to start, showing the 2D map.</p>}
      </div>

      {concept && (
        <div className="galaxy-hud bottom-left card">
          <div className="card-head">
            <span className="dot lg" style={{ background: fieldById.get(concept.field)?.color }} />
            <div>
              <h2>{concept.name}</h2>
              <p className="muted small">
                {fieldById.get(concept.field)?.name} · first seen {concept.first_year} · {concept.papers.toLocaleString()} papers
              </p>
            </div>
            <button className="icon-btn" onClick={() => select(null)} aria-label="Clear selection">×</button>
          </div>
          {conceptGaps.length === 0 ? (
            <p className="muted small">No forecast gaps for this concept in the top list.</p>
          ) : (
            <ul className="mini-list">
              {conceptGaps.slice(0, 6).map((g) => {
                const other = g.a === concept.id ? g.cb : g.ca;
                return (
                  <li key={g.key}>
                    <button onClick={() => onOpenGap(g)}>
                      <span className="dot" style={{ background: fieldById.get(other.field)?.color }} />
                      <span className="grow">× {other.name}</span>
                      <span className="mono">{g.score.toFixed(2)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!concept && focus && (
        <div className="galaxy-hud bottom-left card">
          <div className="card-head">
            <div className="grow">
              <p className="eyebrow">Forecast #{focus.rank}</p>
              <h2>
                {focus.ca.name} <span className="x">×</span> {focus.cb.name}
              </h2>
            </div>
            <button className="icon-btn" onClick={() => onFocusGap(null)} aria-label="Clear highlight">×</button>
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={() => onOpenGap(focus)}>Details</button>
          </div>
        </div>
      )}

      <p className="galaxy-hint muted small">
        {show3d ? "Drag to orbit · scroll to zoom · click a star" : "Click a star to see its forecasts"}
      </p>
    </section>
  );
}
