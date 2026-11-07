import type { Backtest, Concept, Dataset, Field, Gap, GapView, Meta, Vec3 } from "./types";

const DEFAULT_FIELDS: Field[] = [
  { id: "medicine", name: "Medicine & Biology", color: "#ff6b8b" },
  { id: "quant", name: "Quantitative Finance", color: "#ffc04d" },
  { id: "ml", name: "Machine Learning", color: "#5cc8ff" },
  { id: "physics", name: "Physics & Other", color: "#a98bff" },
];

const num = (v: unknown, fallback = 0): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Turn untrusted JSON into a safe Dataset. Missing pieces get defaults instead of crashing. */
export function normalise(raw: unknown): Dataset {
  const r = obj(raw);
  const m = obj(r.meta);
  const meta: Meta = {
    demo: Boolean(m.demo),
    generated: str(m.generated),
    data_end: num(m.data_end, new Date().getFullYear()),
    horizon: str(m.horizon, "next few years"),
    source: str(m.source, "unknown"),
    n_concepts: num(m.n_concepts),
    n_links: num(m.n_links),
  };

  const concepts: Concept[] = arr<unknown>(r.concepts).map((c, i) => {
    const o = obj(c);
    return {
      id: num(o.id, i),
      name: str(o.name, `concept ${i}`),
      field: str(o.field, "physics"),
      first_year: num(o.first_year, meta.data_end),
      papers: Math.max(1, num(o.papers, 1)),
    };
  });
  const ids = new Set(concepts.map((c) => c.id));

  const fieldList = arr<unknown>(r.fields)
    .map((f) => obj(f))
    .filter((f) => typeof f.id === "string")
    .map((f) => ({
      id: f.id as string,
      name: str(f.name, f.id as string),
      color: str(f.color, "#cccccc"),
    }));
  const fields = fieldList.length ? [...fieldList] : [...DEFAULT_FIELDS];
  for (const c of concepts) {
    if (!fields.some((f) => f.id === c.field)) {
      const d = DEFAULT_FIELDS.find((f) => f.id === c.field);
      fields.push(d ?? { id: c.field, name: c.field, color: "#cccccc" });
    }
  }

  const gaps: Gap[] = arr<unknown>(r.gaps)
    .map((g) => obj(g))
    .filter((g) => ids.has(num(g.a, -1)) && ids.has(num(g.b, -1)) && g.a !== g.b)
    .map((g) => ({
      a: num(g.a),
      b: num(g.b),
      score: num(g.score),
      cn: num(g.cn),
      adamic_adar: num(g.adamic_adar),
      pref_attach: num(g.pref_attach),
      growth: num(g.growth),
      bridges: arr<unknown>(g.bridges).filter((x): x is number => typeof x === "number" && ids.has(x)),
      brief: str(g.brief),
    }))
    .sort((x, y) => y.score - x.score);

  let backtest: Backtest | null = null;
  if (r.backtest) {
    const b = obj(r.backtest);
    const p = obj(b.precision);
    const list = (v: unknown) => arr<unknown>(v).map((x) => (typeof x === "number" ? x : null));
    const auc = obj(b.auc);
    const imp = obj(b.importance);
    backtest = {
      train: str(b.train),
      test: str(b.test),
      model: str(b.model),
      candidates: num(b.candidates),
      evaluated: num(b.evaluated),
      positives: num(b.positives),
      base_rate: num(b.base_rate),
      k: arr<unknown>(b.k).filter((x): x is number => typeof x === "number"),
      precision: { model: list(p.model), popularity: list(p.popularity), random: list(p.random) },
      auc: {
        model: typeof auc.model === "number" ? auc.model : undefined,
        popularity: typeof auc.popularity === "number" ? auc.popularity : undefined,
      },
      importance: Object.fromEntries(
        Object.entries(imp).filter((e): e is [string, number] => typeof e[1] === "number"),
      ),
    };
  }

  return { meta, fields, concepts, gaps, backtest };
}

export async function loadDataset(): Promise<Dataset> {
  const url = `${import.meta.env.BASE_URL}data/forecasts.json`;
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`);
  return normalise(await res.json());
}

export function buildGapViews(d: Dataset): GapView[] {
  const byId = new Map(d.concepts.map((c) => [c.id, c]));
  return d.gaps.map((g, i) => ({
    ...g,
    key: `${g.a}-${g.b}`,
    rank: i + 1,
    ca: byId.get(g.a)!,
    cb: byId.get(g.b)!,
    bridgeConcepts: g.bridges.map((id) => byId.get(id)!).filter(Boolean),
  }));
}

export const touchesField = (g: GapView, field: string) => g.ca.field === field || g.cb.field === field;

// ---------------------------------------------------------------------------
// Galaxy layout: each field is a spiral arm, older concepts sit near the core.
// r = a * e^(b * theta), positions are fixed (no force simulation) so the map
// is stable between visits and cheap to draw.
// ---------------------------------------------------------------------------

function hash(n: number): number {
  let x = (n + 1) * 2654435761;
  x = (x ^ (x >>> 16)) >>> 0;
  x = Math.imul(x, 2246822507) >>> 0;
  x = (x ^ (x >>> 13)) >>> 0;
  return x / 4294967295;
}

export function layout(d: Dataset): Map<number, Vec3> {
  const pos = new Map<number, Vec3>();
  if (!d.concepts.length) return pos;
  const years = d.concepts.map((c) => c.first_year);
  const minY = Math.min(...years);
  const span = Math.max(1, Math.max(...years) - minY);
  const arms = d.fields.map((f) => f.id);
  const turn = 1.15 * Math.PI;
  const a = 1.6;
  const b = Math.log(15 / a) / turn;
  for (const c of d.concepts) {
    const arm = Math.max(0, arms.indexOf(c.field));
    const t = (c.first_year - minY) / span;
    const theta = 0.15 + t * turn + (hash(c.id) - 0.5) * 0.35;
    const r = a * Math.exp(b * theta) + (hash(c.id + 7919) - 0.5) * 1.6;
    const ang = (arm / arms.length) * Math.PI * 2 + theta;
    const y = (hash(c.id + 104729) - 0.5) * (2.2 - t * 1.4);
    pos.set(c.id, [r * Math.cos(ang), y, r * Math.sin(ang)]);
  }
  return pos;
}

export const conceptSize = (c: Concept) => 0.14 + 0.09 * Math.log10(c.papers + 1);

// ---------------------------------------------------------------------------
// Links and export helpers
// ---------------------------------------------------------------------------

export function arxivSearchUrl(a: string, b: string): string {
  const q = new URLSearchParams({
    advanced: "",
    "terms-0-operator": "AND",
    "terms-0-term": `"${a}"`,
    "terms-0-field": "abstract",
    "terms-1-operator": "AND",
    "terms-1-term": `"${b}"`,
    "terms-1-field": "abstract",
    "classification-include_cross_list": "include",
    "date-filter_by": "all_dates",
    abstracts: "show",
    size: "50",
    order: "-announced_date_first",
  });
  return `https://arxiv.org/search/advanced?${q.toString()}`;
}

export function scholarUrl(a: string, b: string): string {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(`"${a}" "${b}"`)}`;
}

export function pubmedUrl(a: string, b: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`"${a}" AND "${b}"`)}`;
}

export function gapsToCsv(gaps: GapView[], fieldName: (id: string) => string): string {
  const esc = (s: string | number) => {
    const v = String(s);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const head = ["rank", "concept_a", "field_a", "concept_b", "field_b", "score", "shared_neighbours", "bridges"];
  const rows = gaps.map((g) =>
    [
      g.rank,
      g.ca.name,
      fieldName(g.ca.field),
      g.cb.name,
      fieldName(g.cb.field),
      g.score.toFixed(4),
      g.cn,
      g.bridgeConcepts.map((c) => c.name).join("; "),
    ]
      .map(esc)
      .join(","),
  );
  return [head.join(","), ...rows].join("\n");
}

export function downloadText(filename: string, text: string, type = "text/csv"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null ? "–" : `${(v * 100).toFixed(digits)}%`;

export function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked: ignore */
  }
}
