// The campaign region: heights, biomes, a river, roads between settlements,
// points of interest, and a cost grid for path-finding. Hand-made layout
// (settlement positions and names) with seeded noise for everything else.
import { fbm, clamp, rng } from "../core/math.ts";

export const MAP = 240;              // map units per side (party speed ~1.6 u/h → ~5 days across)
export const CELL = 2;
export const N = MAP / CELL;         // grid cells per side
const HALF = MAP / 2;

export type Biome = "fields" | "forest" | "swamp" | "hills" | "cursed" | "edge";
export type SettlementKind = "village" | "town" | "castle";
export interface Settlement {
  id: string; name: string; kind: SettlementKind; x: number; z: number;
  pop: number;            // people (recruits come out of this)
  prosperity: number;     // 0..1
  recruits: number;       // volunteers waiting now
  burned: boolean;
  culture: "slav" | "german" | "church";
}
export type PoiKind = "hideout" | "ruin" | "cursed" | "gallows" | "graveyard" | "lair" | "monastery" | "grove";
export interface Poi { id: string; kind: PoiKind; name: string; x: number; z: number; alive: boolean }

// Hand-placed settlements (the „ręczna podstawa”); y-down on the map = +z.
const LAYOUT: [string, string, SettlementKind, number, number, Settlement["culture"]][] = [
  ["grauburg", "Grauburg", "town", 38, -42, "german"],
  ["wronsk", "Wrońsk", "town", -52, 30, "slav"],
  ["morwen", "Sankt Morwen", "town", 10, 66, "church"],
  ["straznica", "Czarna Strażnica", "castle", -14, -70, "slav"],
  ["gnilowo", "Gniłowo", "village", -34, -18, "slav"],
  ["brzezie", "Brzezie", "village", -78, -6, "slav"],
  ["ostrowie", "Ostrowie", "village", -70, 66, "slav"],
  ["mokradle", "Mokradle", "village", -22, 44, "slav"],
  ["wilcze", "Wilcze Doły", "village", 58, 10, "slav"],
  ["krucz", "Kruczy Bród", "village", 4, -12, "slav"],
  ["popielec", "Popielec", "village", 62, 58, "church"],
  ["zablocie", "Zabłocie", "village", -6, 92, "church"],
  ["lindenau", "Lindenau", "village", 76, -66, "german"],
  ["harz", "Hartzhof", "village", 22, -88, "german"],
];

export interface World {
  height: (x: number, z: number) => number;
  biome: Biome[];            // per cell
  road: Uint8Array;          // per cell: 1 road, 2 bridge
  river: Uint8Array;         // per cell: 1 water, 2 ford
  settlements: Settlement[];
  pois: Poi[];
  roadLines: [number, number][][];   // polylines in map units (for drawing)
  riverLine: [number, number][];
  cursedSpots: [number, number, number][];
  fords: [number, number][];
}

export const cellOf = (x: number, z: number): [number, number] => [clamp(Math.floor((x + HALF) / CELL), 0, N - 1), clamp(Math.floor((z + HALF) / CELL), 0, N - 1)];
export const centerOf = (i: number, j: number): [number, number] => [-HALF + (i + 0.5) * CELL, -HALF + (j + 0.5) * CELL];
const idx = (i: number, j: number) => j * N + i;

export function buildWorld(seed = 37): World {
  const r = rng(seed);
  const cursedSpots: [number, number, number][] = [[-60, -52, 14], [44, 84, 11], [88, 28, 9]];
  // river: meanders from north to south a little west of centre
  const riverX = (z: number) => -18 + Math.sin(z * 0.022 + 1.3) * 22 + Math.sin(z * 0.061) * 6;
  const height = (x: number, z: number) => {
    let h = fbm(x * 0.012, z * 0.012, 4, seed) * 9 + fbm(x * 0.05, z * 0.05, 2, seed + 3) * 1.2;
    h += Math.max(0, fbm(x * 0.02 + 5, z * 0.02, 3, seed + 9)) * 10;             // hill country
    const e = Math.max(Math.abs(x), Math.abs(z)) / HALF;                            // the dead border rises
    h += Math.pow(clamp((e - 0.84) / 0.16, 0, 1), 2) * 18;
    const rd = Math.abs(x - riverX(z));
    if (rd < 9) h -= (1 - rd / 9) ** 2 * 3.2;                                       // river valley
    return h;
  };
  const biome: Biome[] = new Array(N * N);
  const moist = (x: number, z: number) => fbm(x * 0.018 + 40, z * 0.018, 3, seed + 21);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const [x, z] = centerOf(i, j), h = height(x, z), m = moist(x, z);
    const e = Math.max(Math.abs(x), Math.abs(z)) / HALF;
    let b: Biome = "fields";
    if (e > 0.9) b = "edge";
    else if (cursedSpots.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr)) b = "cursed";
    else if (h > 9) b = "hills";
    else if (m > 0.22 && h < 3) b = "swamp";
    else if (m > 0.1) b = "forest";
    biome[idx(i, j)] = b;
  }
  // settlements clear the land around them into fields
  const settlements: Settlement[] = LAYOUT.map(([id, name, kind, x, z, culture]) => ({
    id, name, kind, x, z, culture, burned: false,
    pop: kind === "town" ? 900 + Math.floor(r() * 500) : kind === "castle" ? 160 : 90 + Math.floor(r() * 120),
    prosperity: 0.35 + r() * 0.4, recruits: 0,
  }));
  for (const s of settlements) {
    s.recruits = s.kind === "village" ? 3 + Math.floor(s.pop / 40) : 0;
    const rad = s.kind === "town" ? 10 : 7;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const [x, z] = centerOf(i, j);
      if (Math.hypot(x - s.x, z - s.z) < rad && biome[idx(i, j)] !== "edge") biome[idx(i, j)] = "fields";
    }
  }
  // river cells
  const river = new Uint8Array(N * N);
  const riverLine: [number, number][] = [];
  for (let z = -HALF; z <= HALF; z += 1) {
    const x = riverX(z); riverLine.push([x, z]);
    for (let w = -1.2; w <= 1.2; w += 0.6) { const [i, j] = cellOf(x + w, z); river[idx(i, j)] = 1; }
  }
  // two fords
  const fords: [number, number][] = [];
  for (const fz of [-30, 52]) {
    fords.push([riverX(fz), fz]);
    for (let dz = -2; dz <= 2; dz += 1) for (let dx = -2; dx <= 2; dx += 1) { const [i, j] = cellOf(riverX(fz) + dx, fz + dz); if (river[idx(i, j)] === 1) river[idx(i, j)] = 2; }
  }
  // roads: minimum spanning tree over settlements + two extra links, routed over the terrain
  const road = new Uint8Array(N * N);
  const roadLines: [number, number][][] = [];
  const S = settlements;
  const inTree = new Set([0]); const edges: [number, number][] = [];
  while (inTree.size < S.length) {
    let best: [number, number] = [0, 0], bd = 1e9;
    for (const a of inTree) for (let b = 0; b < S.length; b++) if (!inTree.has(b)) {
      const d = Math.hypot(S[a].x - S[b].x, S[a].z - S[b].z); if (d < bd) { bd = d; best = [a, b]; }
    }
    edges.push(best); inTree.add(best[1]);
  }
  edges.push([0, 2], [1, 3]);
  const roadCost = (i: number, j: number) => {
    const b = biome[idx(i, j)];
    if (b === "edge") return Infinity;
    let c = b === "fields" ? 1 : b === "hills" ? 2.2 : b === "forest" ? 1.8 : b === "swamp" ? 3 : 2.5;
    if (river[idx(i, j)]) c += 14;          // roads cross the river rarely: those crossings become bridges
    if (road[idx(i, j)]) c *= 0.4;           // reuse existing roads
    return c;
  };
  for (const [a, b] of edges) {
    const path = astar(cellOf(S[a].x, S[a].z), cellOf(S[b].x, S[b].z), roadCost);
    if (!path) continue;
    const line: [number, number][] = [];
    for (const [i, j] of path) {
      road[idx(i, j)] = river[idx(i, j)] ? 2 : 1;
      if (river[idx(i, j)]) river[idx(i, j)] = 3;      // 3 = bridge over water
      line.push(centerOf(i, j));
    }
    roadLines.push(smoothLine(line));
  }
  // points of interest
  const pois: Poi[] = [
    { id: "hideout1", kind: "hideout", name: "Kryjówka zbójców", x: -86, z: -40, alive: true },
    { id: "hideout2", kind: "hideout", name: "Kryjówka w łęgach", x: 30, z: 30, alive: true },
    { id: "ruin1", kind: "ruin", name: "Ruiny cesarskiego fortu", x: 70, z: -20, alive: true },
    { id: "ruin2", kind: "ruin", name: "Spalona kaplica", x: -40, z: 86, alive: true },
    { id: "cursed1", kind: "cursed", name: "Trupie Pole", x: -60, z: -52, alive: true },
    { id: "cursed2", kind: "cursed", name: "Czarny Las", x: 44, z: 84, alive: true },
    { id: "gallows1", kind: "gallows", name: "Szubienica", x: -2, z: 2, alive: true },
    { id: "grave1", kind: "graveyard", name: "Stary cmentarz", x: 20, z: 48, alive: true },
    { id: "monastery", kind: "monastery", name: "Klasztor Świętego Męczennika", x: 32, z: 78, alive: true },
    { id: "grove", kind: "grove", name: "Święty Gaj Peruna", x: -70, z: 46, alive: true },
    { id: "lair_wolf", kind: "lair", name: "Wilcza Jama", x: 88, z: 30, alive: true },
    { id: "lair_water", kind: "lair", name: "Topiel", x: -36, z: 56, alive: true },
    { id: "lair_strzyga", kind: "lair", name: "Kurhan pod Ostrowiem", x: -88, z: 78, alive: true },
  ];
  return { height, biome, road, river, settlements, pois, roadLines, riverLine, cursedSpots, fords };
}

function smoothLine(l: [number, number][]): [number, number][] {
  if (l.length < 3) return l;
  const o: [number, number][] = [l[0]];
  for (let i = 1; i < l.length - 1; i++) o.push([(l[i - 1][0] + l[i][0] * 2 + l[i + 1][0]) / 4, (l[i - 1][1] + l[i][1] * 2 + l[i + 1][1]) / 4]);
  o.push(l[l.length - 1]);
  return o;
}

/** A* over the cell grid with 8-neighbourhood. cost(i,j) = cost to enter that cell (Infinity = blocked). */
export function astar(from: [number, number], to: [number, number], cost: (i: number, j: number) => number): [number, number][] | null {
  const start = idx(from[0], from[1]), goal = idx(to[0], to[1]);
  const g = new Float32Array(N * N).fill(Infinity), came = new Int32Array(N * N).fill(-1);
  const heap: [number, number][] = [];
  const push = (f: number, n: number) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], end = heap.pop()!; if (heap.length) { heap[0] = end; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const hx = (n: number) => Math.hypot((n % N) - to[0], Math.floor(n / N) - to[1]) * 0.45;
  g[start] = 0; push(hx(start), start);
  let guard = 0;
  while (heap.length && guard++ < 60000) {
    const [, n] = pop();
    if (n === goal) break;
    const ci = n % N, cj = Math.floor(n / N);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ni = ci + di, nj = cj + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const c = cost(ni, nj); if (!isFinite(c)) continue;
      const m = idx(ni, nj), ng = g[n] + c * (di && dj ? 1.414 : 1);
      if (ng < g[m]) { g[m] = ng; came[m] = n; push(ng + hx(m), m); }
    }
  }
  if (!isFinite(g[goal])) return null;
  const out: [number, number][] = [];
  for (let n = goal; n !== -1; n = came[n]) out.push([n % N, Math.floor(n / N)]);
  return out.reverse();
}

/** Movement multiplier for a party standing on a cell (roads +30%, forest/swamp −40%, hills −20%). */
export function terrainSpeed(w: World, x: number, z: number): number {
  const [i, j] = cellOf(x, z), k = idx(i, j);
  if (w.road[k]) return 1.3;
  const b = w.biome[k];
  return b === "forest" || b === "swamp" ? 0.6 : b === "hills" ? 0.8 : b === "cursed" ? 0.7 : b === "edge" ? 0.3 : 1;
}
/** Can a party stand on this cell? Water only at bridges (3) and fords (2). */
export function passable(w: World, i: number, j: number) {
  const k = idx(i, j);
  if (w.biome[k] === "edge") return false;
  const rv = w.river[k];
  return rv === 0 || rv === 2 || rv === 3;
}
export function pathCost(w: World, winter: boolean) {
  return (i: number, j: number) => {
    if (!passable(w, i, j)) {
      // frozen rivers can be crossed in winter
      if (winter && w.river[idx(i, j)] === 1) return 1.4;
      return Infinity;
    }
    const [x, z] = centerOf(i, j);
    return 1 / terrainSpeed(w, x, z);
  };
}
export const cellIndex = idx;
export function nearRiver(w: World, x: number, z: number, r = 4): boolean {
  const [i, j] = cellOf(x, z), k = Math.ceil(r / CELL);
  for (let dj = -k; dj <= k; dj++) for (let di = -k; di <= k; di++) {
    const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
    if (w.river[idx(ni, nj)]) return true;
  }
  return false;
}
export function biomeAt(w: World, x: number, z: number): Biome { const [i, j] = cellOf(x, z); return w.biome[idx(i, j)]; }
