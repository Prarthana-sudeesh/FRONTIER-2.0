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
