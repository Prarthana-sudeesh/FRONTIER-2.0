import type { Backtest, Concept, Dataset, Field, Gap, GapView, Meta, Sub } from "./types";

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
      sub: typeof o.sub === "string" && o.sub.trim() ? o.sub.trim() : undefined,
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

/** three.js r163+ needs WebGL 2. */
export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2"));
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

// ---------------------------------------------------------------------------
// Worlds and islands
// ---------------------------------------------------------------------------

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded random generator so islands look the same on every visit. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "island";

/** Group a field's concepts into islands. Uses `sub` when present, otherwise age bands. */
export function subsFor(field: string, data: Dataset, gaps: GapView[], maxIslands = 8): Sub[] {
  const cs = data.concepts.filter((c) => c.field === field);
  if (!cs.length) return [];

  let keyOf: (c: Concept) => string;
  if (cs.some((c) => c.sub)) {
    keyOf = (c) => c.sub ?? "Other topics";
  } else {
    const ys = cs.map((c) => c.first_year).sort((a, b) => a - b);
    const q1 = ys[Math.floor(ys.length / 3)];
    const q2 = ys[Math.floor((2 * ys.length) / 3)];
    keyOf = (c) =>
      c.first_year <= q1 ? `Established ideas (to ${q1})` : c.first_year <= q2 ? `Growing areas (to ${q2})` : `Emerging frontier (${q2 + 1}+)`;
  }

  const groups = new Map<string, Concept[]>();
  for (const c of cs) {
    const k = keyOf(c);
    const list = groups.get(k);
    if (list) list.push(c);
    else groups.set(k, [c]);
  }
  let entries = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  if (entries.length > maxIslands) {
    const rest = entries.slice(maxIslands - 1).flatMap((e) => e[1]);
    entries = [...entries.slice(0, maxIslands - 1), ["More topics", rest]];
  }

  return entries.map(([name, list]) => {
    const ids = new Set(list.map((c) => c.id));
    return {
      id: slug(name),
      name,
      field,
      concepts: [...list].sort((a, b) => b.papers - a.papers),
      gaps: gaps.filter((g) => ids.has(g.a) || ids.has(g.b)),
      seed: hashStr(`${field}/${name}`),
    };
  });
}

export type Pt = [number, number];

/** Outline of an island. Four families: round, crescent, twin-lobed and jagged. */
export function islandShape(seed: number, size: number): Pt[] {
  const r = rng(seed);
  const kind = Math.floor(r() * 4);
  const pts: Pt[] = [];
  const wob = (a: number) => 1 + 0.05 * Math.sin(5 * a + seed) + 0.03 * Math.sin(9 * a + seed * 0.7);

  if (kind === 1) {
    // crescent: a big circle with a smaller one bitten out of its side
    const R = size * 1.1;
    const d = 0.5 * R;
    const rr = 0.78 * R;
    const ax = (R * R - rr * rr + d * d) / (2 * d);
    const ay = Math.sqrt(Math.max(R * R - ax * ax, 0.01));
    const t0 = Math.atan2(ay, ax);
    const p0 = Math.atan2(ay, ax - d);
    const n = 40;
    for (let i = 0; i <= n; i++) {
      const a = t0 + ((2 * Math.PI - 2 * t0) * i) / n;
      pts.push([R * wob(a) * Math.cos(a), R * wob(a) * Math.sin(a)]);
    }
    for (let i = 1; i < n; i++) {
      const a = 2 * Math.PI - p0 - ((2 * Math.PI - 2 * p0) * i) / n;
      pts.push([d + rr * Math.cos(a), rr * Math.sin(a)]);
    }
  } else {
    const amps =
      kind === 0
        ? [0, 0, 0.08, 0.06, 0.04, 0.03]
        : kind === 2
          ? [0, 0, 0.34, 0.05, 0.06, 0.02]
          : [0, 0, 0.06, 0.12, 0.05, 0.16];
    const phase = amps.map(() => r() * Math.PI * 2);
    const n = 72;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      let k = 1;
      for (let h = 2; h < amps.length; h++) k += amps[h] * Math.cos(h * a + phase[h]);
      const rad = size * Math.max(0.4, k) * wob(a);
      pts.push([rad * Math.cos(a), rad * Math.sin(a)]);
    }
  }
  const rot = r() * Math.PI * 2;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

export function insidePolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Up to `n` well-spaced points inside a polygon (deterministic). */
export function scatterInside(poly: Pt[], n: number, seed: number, minDist: number): Pt[] {
  const r = rng(seed);
  let maxR = 0;
  for (const [x, y] of poly) maxR = Math.max(maxR, Math.hypot(x, y));
  const out: Pt[] = [];
  for (let tries = 0; tries < n * 60 && out.length < n; tries++) {
    const p: Pt = [(r() * 2 - 1) * maxR, (r() * 2 - 1) * maxR];
    if (!insidePolygon(p, poly)) continue;
    if (out.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < minDist)) continue;
    out.push(p);
  }
  return out;
}

export const scalePts = (pts: Pt[], k: number): Pt[] => pts.map(([x, y]) => [x * k, y * k]);

export function svgPath(pts: Pt[]): string {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`).join("") + "Z";
}

/** Visual identity of each research world. */
export interface WorldStyle {
  planet: number; // shader type: 0 ocean, 1 gas giant, 2 ice/tech, 3 volcanic
  atmosphere: string;
  water: [string, string];
  sand: string;
  top: string;
  peak: string;
  deco: "palm" | "tower" | "crystal" | "vent";
  tagline: string;
}

const WORLDS: Record<string, WorldStyle> = {
  medicine: { planet: 0, atmosphere: "#8fb8ff", water: ["#0b2f55", "#1f8fa8"], sand: "#e7d2a6", top: "#3d9b5b", peak: "#2c6e45", deco: "palm", tagline: "A living ocean world" },
  quant: { planet: 1, atmosphere: "#ffcf7a", water: ["#1c2350", "#3a6aa0"], sand: "#e2b56b", top: "#c7833a", peak: "#9a5a2a", deco: "tower", tagline: "A banded gas giant of markets" },
  ml: { planet: 2, atmosphere: "#8fe6ff", water: ["#0c2a4a", "#3aa7c8"], sand: "#d6ecf6", top: "#f3fbff", peak: "#dbefff", deco: "crystal", tagline: "An icy world of machines" },
  physics: { planet: 3, atmosphere: "#d68bff", water: ["#1a0f3a", "#4a3a8a"], sand: "#5a3d78", top: "#2e1c45", peak: "#22132f", deco: "vent", tagline: "A volcanic world of forces" },
};
const ORDER = ["medicine", "quant", "ml", "physics"];

export function worldStyle(field: string): WorldStyle {
  return WORLDS[field] ?? WORLDS[ORDER[hashStr(field) % 4]];
}
