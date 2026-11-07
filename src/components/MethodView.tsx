import type { Dataset } from "../types";

const STEPS = [
  {
    n: "1",
    title: "Read the literature",
    body: "Stream the arXiv metadata, keep the chosen fields, and date every paper by its first submission (not its last update).",
  },
  {
    n: "2",
    title: "Extract concepts",
    body: "Build a vocabulary of noun phrases from older papers only, clean out generic words, then tag every abstract against it.",
  },
  {
    n: "3",
    title: "Build the concept network",
    body: "Concepts are nodes. Two concepts are linked the first time a paper mentions both. Unlinked pairs are possible research gaps.",
  },
  {
    n: "4",
    title: "Forecast and test",
    body: "A gradient-boosted model learns from network features (shared neighbours, Adamic–Adar, growth) which gaps close next, and is backtested out-of-sample.",
  },
];

export default function MethodView({ data }: { data: Dataset }) {
  return (
    <section className="page">
      <header className="page-head">
        <p className="eyebrow">Literature-based discovery</p>
        <h1>How FRONTIER finds research gaps</h1>
        <p className="lead">
          In the 1980s Don Swanson noticed that fish oil and Raynaud&apos;s disease had never been studied together, though
          both were linked to blood viscosity. The link was later confirmed. FRONTIER automates that idea across thousands of
          concepts and checks itself against history.
        </p>
      </header>

      <ol className="steps">
        {STEPS.map((s) => (
          <li key={s.n} className="panel">
            <span className="step-n mono">{s.n}</span>
            <h2>{s.title}</h2>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>

      <div className="two-col">
        <div className="panel">
          <h2>Using it as a PhD student</h2>
          <ul className="ticks">
            <li>Open the leaderboard and pick your field: Medicine or Quant.</li>
            <li>Shortlist gaps whose bridge concepts you already know. That is your unfair advantage.</li>
            <li>Run the arXiv, Scholar and PubMed checks: a forecast can already be done.</li>
            <li>Read the bridge papers to find the actual mechanism before pitching it to a supervisor.</li>
            <li>Export the list as CSV to share with your group.</li>
          </ul>
        </div>
        <div className="panel">
          <h2>Limits to keep in mind</h2>
          <ul className="ticks warn">
            <li>A &ldquo;discovery&rdquo; here is a first co-mention in an abstract, not a proven result.</li>
            <li>Synonyms, symbols and concepts outside the vocabulary are missed.</li>
            <li>Coverage is arXiv only; much clinical research lives in journals and PubMed.</li>
            <li>Scores are probabilities. Most top forecasts will not happen in the window.</li>
            <li>Summaries are template text grounded in the data, not literature reviews.</li>
          </ul>
        </div>
      </div>

      <div className="panel">
        <h2>About this data</h2>
        <dl className="facts">
          <dt>Source</dt>
          <dd>{data.meta.source}</dd>
          <dt>Concepts</dt>
          <dd>{data.concepts.length.toLocaleString()}</dd>
          <dt>Forecast gaps</dt>
          <dd>{data.gaps.length.toLocaleString()}</dd>
          <dt>Data up to</dt>
          <dd>{data.meta.data_end}</dd>
          <dt>Forecast window</dt>
          <dd>{data.meta.horizon}</dd>
          <dt>Generated</dt>
          <dd>{data.meta.generated || "–"}</dd>
        </dl>
        <p className="muted small">
          To refresh, run <code>pipeline/frontier_data.py</code> then <code>pipeline/frontier_model.py</code>, which writes{" "}
          <code>web/public/data/forecasts.json</code>, and redeploy.
        </p>
      </div>
    </section>
  );
}
