# FRONTIER 2.0 — research gap forecasts

A website that shows which research concepts are likely to be studied together
for the first time, so PhD students can spot open research gaps early.

- **Galaxy**: 3D map of research concepts (2D fallback when WebGL is missing).
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
The site reads `public/data/forecasts.json`. It currently holds clearly labelled
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
The build is static with relative paths, so `dist/` works on any host.
- **GitHub Pages**: Settings → Pages → Source: *GitHub Actions*. The `Deploy website`
  workflow publishes on every push to `main`.
- **Netlify** / **Vercel**: import the repo; `netlify.toml` / `vercel.json` are ready.
