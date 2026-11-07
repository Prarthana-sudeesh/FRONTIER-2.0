export type FieldId = string;

export interface Field {
  id: FieldId;
  name: string;
  color: string;
}

export interface Concept {
  id: number;
  name: string;
  field: FieldId;
  first_year: number;
  papers: number;
  /** Sub-category, e.g. an arXiv category. Each one becomes an island. */
  sub?: string;
}

export interface Gap {
  a: number;
  b: number;
  score: number;
  cn: number;
  adamic_adar: number;
  pref_attach: number;
  growth: number;
  bridges: number[];
  brief: string;
}

export interface Backtest {
  train: string;
  test: string;
  model: string;
  candidates: number;
  evaluated: number;
  positives: number;
  base_rate: number;
  k: number[];
  precision: { model: (number | null)[]; popularity: (number | null)[]; random: (number | null)[] };
  auc: { model?: number; popularity?: number };
  importance: Record<string, number>;
}

export interface Meta {
  demo: boolean;
  generated: string;
  data_end: number;
  horizon: string;
  source: string;
  n_concepts: number;
  n_links: number;
}

export interface Dataset {
  meta: Meta;
  fields: Field[];
  concepts: Concept[];
  gaps: Gap[];
  backtest: Backtest | null;
}

/** A gap joined with its concepts, ready for display. */
export interface GapView extends Gap {
  key: string;
  rank: number;
  ca: Concept;
  cb: Concept;
  bridgeConcepts: Concept[];
}

export type Vec3 = [number, number, number];

/** One island: a sub-category of a field with its concepts and gaps. */
export interface Sub {
  id: string;
  name: string;
  field: FieldId;
  concepts: Concept[];
  gaps: GapView[];
  seed: number;
}
