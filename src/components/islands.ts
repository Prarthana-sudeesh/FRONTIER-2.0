import { islandShape, scalePts, scatterInside, type Pt } from "../data";
import type { Concept, Sub } from "../types";

export const SPACING = 17;
export const islandX = (i: number) => i * SPACING;
export const islandZ = (i: number) => (i % 2 ? -3 : 1.5);

export interface IslandLayout {
  size: number;
  shape: Pt[];
  top: Pt[];
  foam: Pt[];
  peak: Pt | null;
  beacons: { concept: Concept; p: Pt }[];
  decos: Pt[];
}

/** Where everything sits on an island. Concepts in forecast gaps get the first beacons. */
export function islandLayout(sub: Sub): IslandLayout {
  const size = 3 + Math.min(1.8, Math.sqrt(sub.concepts.length) * 0.35);
  const shape = islandShape(sub.seed, size);
  const spots = scatterInside(scalePts(shape, 0.68), 18, sub.seed + 1, size * 0.27);
  const inGap = new Set(sub.gaps.flatMap((g) => [g.a, g.b]));
  const ranked = [...sub.concepts].sort((a, b) => Number(inGap.has(b.id)) - Number(inGap.has(a.id)) || b.papers - a.papers);
  const nBeacons = Math.min(9, Math.max(0, spots.length - 1), ranked.length);
  return {
    size,
    shape,
    top: scalePts(shape, 0.84),
    foam: scalePts(shape, 1.16),
    peak: spots[0] ?? null,
    beacons: ranked.slice(0, nBeacons).map((concept, k) => ({ concept, p: spots[k + 1] })),
    decos: spots.slice(1 + nBeacons, 7 + nBeacons),
  };
}
