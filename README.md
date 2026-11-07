# FRONTIER 2.0 — research gap forecasts

A website that shows which research concepts are likely to be studied together
for the first time, so PhD students can spot open research gaps early.

- **Explore**: four realistic planets, one per field. Click one to dive into an ocean
  of floating islands, one per sub-topic. Scroll sideways (or use ← →, swipe, or the
  arrows) to sail between islands; scroll down to unroll an island's scroll of research
  gaps, scroll up to roll it away, and keep scrolling up to rise back to space.
  Browsers without WebGL 2 get a 2D version of both views.
- **Research gaps**: search, filter, sort, CSV export, and links to check arXiv,
  Google Scholar and PubMed before starting work.
- **Backtest**: how well the forecasts did on past years vs. simple baselines.
- **Leaderboard**: a side panel you can open and close, with upcoming gaps in
  **Medicine** and **Quant**.

## Run locally
```bash
npm install
npm run dev      # dev server
npm run build    # type-check + production build into dist/
```

## Data
The site reads `public/data/forecasts.json`. Each concept can carry a `sub` field
(for example an arXiv category name); each distinct `sub` becomes an island. Without
it, islands are grouped by when concepts first appeared. It currently holds clearly labelled
**demo data** (a banner says so on the site).

Real forecasts come from the model in the FRONTIER repo
(`harri-selva/FRONTIER`):
```bash
python b2/export_web.py --out forecasts.json
# or
python pipeline/frontier_model.py --concepts data/paper_concepts.parquet --out forecasts.json
```
Copy the resulting `forecasts.json` into `public/data/` here and redeploy.

## Deploy
Step-by-step guide for anyone, including without GitHub Actions: **[DEPLOY.md](DEPLOY.md)**.

The build is static with relative paths, so `dist/` works on any host.
- **GitHub Pages**: Settings → Pages → Source: *GitHub Actions*. The `Deploy website`
  workflow publishes on every push to `main`.
- **Netlify** / **Vercel**: import the repo; `netlify.toml` / `vercel.json` are ready.
