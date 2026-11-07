import { useCallback, useEffect, useMemo, useState } from "react";
import { buildGapViews, layout, loadDataset, readStore, writeStore } from "./data";
import type { Dataset, GapView } from "./types";
import Leaderboard, { type Board } from "./components/Leaderboard";
import GapModal from "./components/GapModal";
import GalaxyView from "./components/GalaxyView";
import GapsView from "./components/GapsView";
import BacktestView from "./components/BacktestView";
import MethodView from "./components/MethodView";

const VIEWS = [
  { id: "galaxy", label: "Galaxy" },
  { id: "gaps", label: "Research gaps" },
  { id: "backtest", label: "Backtest" },
  { id: "method", label: "How it works" },
] as const;
type View = (typeof VIEWS)[number]["id"];

const viewFromHash = (): View => {
  const h = window.location.hash.replace(/^#\/?/, "");
  return (VIEWS.find((v) => v.id === h)?.id ?? "galaxy") as View;
};

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>(viewFromHash);
  const [lbOpen, setLbOpen] = useState<boolean>(() => {
    const saved = readStore("frontier.leaderboard");
    return saved == null ? window.innerWidth >= 1100 : saved === "open";
  });
  const [board, setBoard] = useState<Board>(() => (readStore("frontier.board") === "quant" ? "quant" : "medicine"));
  const [openGap, setOpenGap] = useState<GapView | null>(null);
  const [focusGap, setFocusGap] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    loadDataset()
      .then((d) => alive && setData(d))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => writeStore("frontier.leaderboard", lbOpen ? "open" : "closed"), [lbOpen]);
  useEffect(() => writeStore("frontier.board", board), [board]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (openGap) setOpenGap(null);
      else if (lbOpen && window.innerWidth < 1100) setLbOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openGap, lbOpen]);

  const gaps = useMemo(() => (data ? buildGapViews(data) : []), [data]);
  const positions = useMemo(() => (data ? layout(data) : new Map()), [data]);
  const fieldById = useMemo(() => new Map((data?.fields ?? []).map((f) => [f.id, f])), [data]);

  const go = useCallback((v: View) => {
    if (window.location.hash !== `#${v}`) window.location.hash = v;
    setView(v);
  }, []);

  const showInGalaxy = useCallback(
    (g: GapView) => {
      setOpenGap(null);
      setFocusGap(g.key);
      setSelected(null);
      go("galaxy");
    },
    [go],
  );

  return (
    <div className={`app ${lbOpen ? "lb-open" : ""}`}>
      <header className="topbar">
        <a className="brand" href="#galaxy" onClick={() => setView("galaxy")} aria-label="FRONTIER home">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">FRONTIER</span>
          <span className="brand-tag">research gap forecasts</span>
        </a>
        <nav className="tabs" aria-label="Sections">
          {VIEWS.map((v) => (
            <a
              key={v.id}
              href={`#${v.id}`}
              className={`tab ${view === v.id ? "active" : ""}`}
              aria-current={view === v.id ? "page" : undefined}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </a>
          ))}
        </nav>
        <button
          className={`lb-toggle ${lbOpen ? "on" : ""}`}
          onClick={() => setLbOpen((o) => !o)}
          aria-expanded={lbOpen}
          aria-controls="leaderboard"
        >
          <TrophyIcon />
          <span>Leaderboard</span>
        </button>
      </header>

      {data?.meta.demo && (
        <div className="demo-banner" role="note">
          Showing <strong>demo data</strong>. Gaps and backtest numbers are illustrative until you run{" "}
          <code>pipeline/frontier_model.py</code> on the arXiv data.
        </div>
      )}

      <main className={`main view-${view}`}>
        {error && (
          <div className="state error">
            <h2>Could not load forecasts</h2>
            <p>{error}</p>
            <p>
              Check that <code>data/forecasts.json</code> is deployed next to <code>index.html</code>.
            </p>
            <button className="btn" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        )}
        {!error && !data && (
          <div className="state">
            <div className="spinner" aria-hidden="true" />
            <p>Loading the research galaxy…</p>
          </div>
        )}
        {data && view === "galaxy" && (
          <GalaxyView
            data={data}
            gaps={gaps}
            positions={positions}
            fieldById={fieldById}
            selected={selected}
            onSelect={setSelected}
            focusGap={focusGap}
            onFocusGap={setFocusGap}
            onOpenGap={setOpenGap}
          />
        )}
        {data && view === "gaps" && <GapsView data={data} gaps={gaps} fieldById={fieldById} onOpenGap={setOpenGap} />}
        {data && view === "backtest" && <BacktestView data={data} />}
        {data && view === "method" && <MethodView data={data} />}
      </main>

      {!lbOpen && (
        <button className="lb-edge" onClick={() => setLbOpen(true)} aria-label="Open leaderboard" aria-controls="leaderboard">
          <TrophyIcon />
          <span>Upcoming gaps</span>
        </button>
      )}
      {lbOpen && <div className="lb-backdrop" onClick={() => setLbOpen(false)} aria-hidden="true" />}
      <Leaderboard
        open={lbOpen}
        onClose={() => setLbOpen(false)}
        board={board}
        onBoard={setBoard}
        gaps={gaps}
        fieldById={fieldById}
        horizon={data?.meta.horizon ?? ""}
        onOpenGap={setOpenGap}
        activeKey={openGap?.key ?? focusGap}
      />

      {openGap && data && (
        <GapModal gap={openGap} fieldById={fieldById} meta={data.meta} onClose={() => setOpenGap(null)} onShow={showInGalaxy} />
      )}
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" strokeLinejoin="round" />
      <path d="M17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3" strokeLinejoin="round" />
    </svg>
  );
}
