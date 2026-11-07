import { pct } from "../data";
import type { Dataset } from "../types";

const SERIES = [
  { key: "model", label: "FRONTIER model", color: "#5cc8ff" },
  { key: "popularity", label: "Popular × popular", color: "#ffc04d" },
  { key: "random", label: "Random pairs", color: "#8a8fa8" },
] as const;

const FEATURE_NAMES: Record<string, string> = {
  cn: "Common neighbours",
  jaccard: "Jaccard",
  adamic_adar: "Adamic–Adar",
  resource_alloc: "Resource allocation",
  pref_attach: "Preferential attachment",
  deg_min: "Degree (smaller)",
  deg_max: "Degree (larger)",
  growth_min: "Recent growth (smaller)",
  growth_max: "Recent growth (larger)",
  age_min: "Concept age (younger)",
  age_max: "Concept age (older)",
};

export default function BacktestView({ data }: { data: Dataset }) {
  const bt = data.backtest;
  if (!bt || !bt.k.length) {
    return (
      <section className="page">
        <h1>Backtest</h1>
        <div className="empty">This dataset has no backtest results. Run the model script to add them.</div>
      </section>
    );
  }

  const i100 = Math.max(0, bt.k.indexOf(100));
  const pm = bt.precision.model[i100];
  const pp = bt.precision.popularity[i100];
  const lift = (a: number | null | undefined, b: number | null | undefined) =>
    a != null && b ? `${(a / b).toFixed(1)}×` : "–";

  const all = SERIES.flatMap((s) => bt.precision[s.key]).filter((v): v is number => v != null);
  const max = Math.max(0.01, ...all);
  const imp = Object.entries(bt.importance).sort((a, b) => b[1] - a[1]);
  const impMax = Math.max(0.0001, ...imp.map((e) => e[1]));

  // chart geometry
  const W = 640;
  const H = 260;
  const padL = 44;
  const padB = 34;
  const groupW = (W - padL) / bt.k.length;
  const barW = Math.min(30, (groupW - 16) / SERIES.length);
  const y = (v: number) => H - padB - (v / max) * (H - padB - 12);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);

  return (
    <section className="page">
      <header className="page-head">
        <p className="eyebrow">Out-of-sample validation</p>
        <h1>Would it have worked in the past?</h1>
        <p className="lead">
          We freeze the literature at a past date, forecast, then check against what was actually published later. The
          model never sees the test years while it is built.
        </p>
      </header>

      {data.meta.demo && <div className="notice">Demo numbers. Run the pipeline on arXiv data to see real results.</div>}

      <div className="kpis">
        <Kpi label="Base rate" value={pct(bt.base_rate, 2)} hint="Share of candidate pairs that really met" />
        <Kpi label="Precision@100" value={pct(pm)} hint="Hit rate of the model's top 100 forecasts" />
        <Kpi label="Lift vs random" value={lift(pm, bt.base_rate)} hint="Precision@100 ÷ base rate" />
        <Kpi label="Lift vs popularity" value={lift(pm, pp)} hint="The claim that matters: beating 'popular meets popular'" />
        <Kpi label="AUC" value={bt.auc.model != null ? bt.auc.model.toFixed(3) : "–"} hint={`Popularity baseline: ${bt.auc.popularity?.toFixed(3) ?? "–"}`} />
      </div>

      <div className="panel">
        <h2>Precision at K</h2>
        <p className="muted small">Of the top K pairs each method ranked, the share that were first studied together in the test window.</p>
        <ul className="legend inline">
          {SERIES.map((s) => (
            <li key={s.key}>
              <span className="dot" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Precision at K for model and baselines">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W} y1={y(t)} y2={y(t)} className="grid" />
                <text x={padL - 6} y={y(t) + 4} textAnchor="end" className="axis">
                  {Math.round(t * 100)}%
                </text>
              </g>
            ))}
            {bt.k.map((k, gi) => {
              const x0 = padL + gi * groupW + (groupW - barW * SERIES.length) / 2;
              return (
                <g key={k}>
                  {SERIES.map((s, si) => {
                    const v = bt.precision[s.key][gi];
                    if (v == null) return null;
                    const h = H - padB - y(v);
                    return (
                      <rect key={s.key} x={x0 + si * barW} y={y(v)} width={barW - 3} height={Math.max(h, 1)} rx={3} fill={s.color}>
                        <title>{`${s.label}, K=${k}: ${pct(v)}`}</title>
                      </rect>
                    );
                  })}
                  <text x={padL + gi * groupW + groupW / 2} y={H - 10} textAnchor="middle" className="axis">
                    K={k}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="two-col">
        <div className="panel">
          <h2>Set-up</h2>
          <dl className="facts">
            <dt>Training</dt>
            <dd>{bt.train || "–"}</dd>
            <dt>Testing</dt>
            <dd>{bt.test || "–"}</dd>
            <dt>Model</dt>
            <dd>{bt.model || "–"}</dd>
            <dt>Candidate pairs</dt>
            <dd>{bt.candidates.toLocaleString()} (2-hop, never linked)</dd>
            <dt>Pairs that met</dt>
            <dd>{bt.positives.toLocaleString()}</dd>
          </dl>
        </div>
        <div className="panel">
          <h2>What drives the forecast</h2>
          {imp.length === 0 ? (
            <p className="muted small">Feature importance is not available for this model.</p>
          ) : (
            <ul className="bars">
              {imp.map(([k, v]) => (
                <li key={k}>
                  <span className="bars-label">{FEATURE_NAMES[k] ?? k}</span>
                  <span className="bars-track">
                    <span style={{ width: `${(v / impMax) * 100}%` }} />
                  </span>
                  <span className="mono small">{pct(v, 0)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="kpi" title={hint}>
      <span className="kpi-value mono">{value}</span>
      <span className="kpi-label">{label}</span>
      <span className="kpi-hint">{hint}</span>
    </div>
  );
}
