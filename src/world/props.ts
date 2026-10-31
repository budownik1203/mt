// Static scenery merged into one mesh: pines, dead trees, rocks, a ruined
// chapel, gallows with a crow cage, a bandit camp with a fire.
import { rng, clamp } from "../core/math.ts";
import { MeshBuilder, T, hex } from "../gfx/meshbuilder.ts";
import { height, roadDist, slope, WORLD } from "./terrain.ts";

export interface Collider { x: number; z: number; r: number }
export interface Scenery { mesh: MeshBuilder; colliders: Collider[]; fires: [number, number, number][] }

const BARK = hex(0x3b2f26), BARK_D = hex(0x2a2420), PINE = hex(0x27382b), PINE_D = hex(0x1f2d23), STONE = hex(0x6d6a62), STONE_D = hex(0x55524b),
  WOOD = hex(0x5a4532), WOOD_D = hex(0x3e3024), IRON = hex(0x34363a), CLOTH = hex(0x5d5444), CLOTH_R = hex(0x5e2a24), BONE = hex(0xb5ab92), ASH = hex(0x2b2826), EMBER = hex(0xb4561e);

function pine(b: MeshBuilder, x: number, z: number, s: number, r: () => number) {
  const y = height(x, z) - 0.2;
  b.cyl(T(x, y, z), 0.22 * s, 0.12 * s, 3.2 * s, 5, BARK);
  const tiers = 4;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    b.cyl(T(x, y + (1.6 + i * 1.5) * s, z, r() * 6), (2.4 - t * 1.6) * s, 0, (2.6 - t * 0.6) * s, 6, i % 2 ? PINE : PINE_D, false);
  }
}

function deadTree(b: MeshBuilder, x: number, z: number, s: number, r: () => number) {
  const y = height(x, z) - 0.2;
  b.cyl(T(x, y, z, 0, (r() - 0.5) * 0.15), 0.28 * s, 0.1 * s, 6 * s, 5, BARK_D);
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2, h = (2.5 + r() * 3) * s;
    b.cyl(T(x, y + h, z, a, 0, -0.7 - r() * 0.5), 0.09 * s, 0.02 * s, (1.8 + r() * 1.5) * s, 4, BARK_D);
  }
}

function chapel(b: MeshBuilder, cx: number, cz: number, rot: number, cols: Collider[]) {
  const y = height(cx, cz);
  const L = 14, W = 8, c = Math.cos(rot), s = Math.sin(rot);
  const P = (lx: number, lz: number) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
  const wall = (lx: number, lz: number, len: number, along: boolean, h: number) => {
    const n = Math.ceil(len / 1.2);
    for (let i = 0; i < n; i++) {
      const o = -len / 2 + (i + 0.5) * (len / n);
      const [wx, wz] = along ? P(lx + o, lz) : P(lx, lz + o);
      const hh = h * (0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + lx)));
      b.box(T(wx, y + hh / 2 - 0.3, wz, rot + (along ? 0 : Math.PI / 2)), len / n + 0.05, hh, 0.9, i % 2 ? STONE : STONE_D);
      cols.push({ x: wx, z: wz, r: 0.75 });
    }
  };
  wall(0, -W / 2, L, true, 5.5);
  wall(0, W / 2, L * 0.6, true, 4);
  wall(-L / 2, 0, W, false, 7);
  // tower stump
  const [tx, tz] = P(-L / 2 - 1.5, 0);
  b.box(T(tx, y + 4, tz, rot), 3.4, 9, 3.4, STONE_D); cols.push({ x: tx, z: tz, r: 2.2 });
  // fallen columns and rubble
  const r = rng(77);
  for (let i = 0; i < 18; i++) {
    const [qx, qz] = P((r() - 0.5) * L, (r() - 0.5) * W * 1.4);
    b.rock(T(qx, height(qx, qz) + 0.2, qz), 0.35 + r() * 0.5, STONE, 0.3, i);
  }
}

function gallows(b: MeshBuilder, x: number, z: number, rot: number, cols: Collider[]) {
  const y = height(x, z);
  b.box(T(x, y + 2.6, z, rot), 0.3, 5.4, 0.3, WOOD_D);
  b.box(T(x + Math.sin(rot) * 0, y + 5.2, z, rot, 0, 0), 0.25, 0.25, 3.2, WOOD);
  b.box(T(x, y + 4.5, z + 0.6, rot, -0.8), 0.15, 0.15, 1.6, WOOD);
  // cage with bones
  const cz = z + 1.3, cy = y + 3.2;
  b.box(T(x, cy + 1.8, cz), 0.04, 0.8, 0.04, IRON);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.box(T(x + Math.cos(a) * 0.45, cy + 0.6, cz + Math.sin(a) * 0.45), 0.05, 1.4, 0.05, IRON);
  }
  b.cyl(T(x, cy - 0.1, cz), 0.5, 0.5, 0.1, 6, IRON);
  b.cyl(T(x, cy + 1.3, cz), 0.5, 0.2, 0.25, 6, IRON);
  b.rock(T(x, cy + 0.15, cz), 0.13, BONE, 0.1, 9);
  b.box(T(x + 0.1, cy + 0.05, cz, 0.5), 0.5, 0.06, 0.07, BONE);
  cols.push({ x, z, r: 0.5 });
}

function camp(b: MeshBuilder, x: number, z: number, cols: Collider[], fires: [number, number, number][]) {
  const y = height(x, z);
  // fire ring
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.rock(T(x + Math.cos(a) * 0.8, y + 0.1, z + Math.sin(a) * 0.8), 0.22, STONE_D, 0.3, i + 40); }
  b.cyl(T(x, y - 0.05, z), 0.7, 0.6, 0.12, 7, ASH);
  for (let i = 0; i < 4; i++) b.box(T(x, y + 0.2, z, i * 0.8, 0, 0.35), 0.12, 0.12, 1.1, i % 2 ? WOOD_D : EMBER);
  fires.push([x, y + 0.6, z]);
  cols.push({ x, z, r: 0.9 });
  // tents
  const tent = (tx: number, tz: number, rot: number, col: number[]) => {
    const ty = height(tx, tz);
    const c = Math.cos(rot), s = Math.sin(rot);
    const pt = (lx: number, ly: number, lz: number) => [tx + lx * c + lz * s, ty + ly, tz - lx * s + lz * c];
    const A = pt(-1.4, 0, -1.8), B = pt(1.4, 0, -1.8), C = pt(1.4, 0, 1.8), D = pt(-1.4, 0, 1.8), R1 = pt(0, 2.1, -1.8), R2 = pt(0, 2.1, 1.8);
    b.quad(A, R1, R2, D, col as never); b.quad(B, C, R2, R1, col as never);
    b.tri(A, B, R1, col as never);
    cols.push({ x: tx, z: tz, r: 1.8 });
  };
  tent(x + 5, z + 2, 0.4, CLOTH); tent(x - 4, z + 4, -0.6, CLOTH_R); tent(x + 1, z - 5.5, 1.5, CLOTH);
  // spiked stakes with skulls
  for (let i = 0; i < 3; i++) {
    const sx = x - 6 + i * 1.2, sz = z - 3 - i * 0.4, sy = height(sx, sz);
    b.cyl(T(sx, sy, sz, 0, 0.1 * i), 0.07, 0.01, 2.4, 4, WOOD_D);
    b.rock(T(sx, sy + 2.1, sz), 0.15, BONE, 0.15, i + 60);
    cols.push({ x: sx, z: sz, r: 0.3 });
  }
  // barrels and crates
  b.cyl(T(x + 3, y, z - 2), 0.4, 0.4, 0.9, 7, WOOD); cols.push({ x: x + 3, z: z - 2, r: 0.5 });
  b.box(T(x + 3.2, y + 0.35, z - 3.1, 0.3), 0.7, 0.7, 0.7, WOOD_D); cols.push({ x: x + 3.2, z: z - 3.1, r: 0.5 });
}

export function buildScenery(): Scenery {
  const b = new MeshBuilder();
  const cols: Collider[] = [];
  const fires: [number, number, number][] = [];
  const r = rng(4242);
  const half = WORLD / 2 - 6;
  let placed = 0;
  for (let i = 0; i < 2600 && placed < 520; i++) {
    const x = (r() - 0.5) * 2 * half, z = (r() - 0.5) * 2 * half;
    const d = Math.hypot(x, z);
    if (d < 32 || roadDist(x, z) < 6) continue;
    const forest = clamp((d - 40) / 70, 0, 1);
    if (r() > forest * 0.9 + 0.05) continue;
    if (slope(x, z) > 0.8) continue;
    const s = 0.8 + r() * 0.7;
    if (r() < 0.82) pine(b, x, z, s, r); else deadTree(b, x, z, s, r);
    if (d < 70) cols.push({ x, z, r: 0.35 * s });
    placed++;
  }
  for (let i = 0; i < 90; i++) {
    const x = (r() - 0.5) * 2 * half, z = (r() - 0.5) * 2 * half;
    if (Math.hypot(x, z) < 14 || roadDist(x, z) < 4) continue;
    const s = 0.4 + r() * 1.6;
    b.rock(T(x, height(x, z) + s * 0.2, z, r() * 6), s, r() < 0.5 ? STONE : STONE_D, 0.35, i);
    if (Math.hypot(x, z) < 70) cols.push({ x, z, r: s * 0.85 });
  }
  chapel(b, -26, -30, 0.5, cols);
  gallows(b, 14, -16, 0.2, cols);
  camp(b, 24, 22, cols, fires);
  brazier(b, 9, 7, cols, fires);
  brazier(b, -10, 5, cols, fires);
  brazier(b, 1, -11, cols, fires);
  return { mesh: b, colliders: cols, fires };
}

/** Iron braziers that light the killing field at night. */
export function brazier(b: MeshBuilder, x: number, z: number, cols: Collider[], fires: [number, number, number][]) {
  const y = height(x, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    b.box(T(x + Math.cos(a) * 0.25, y + 0.55, z + Math.sin(a) * 0.25, -a, 0, 0.25), 0.05, 1.15, 0.05, IRON);
  }
  b.cyl(T(x, y + 1.05, z), 0.22, 0.4, 0.3, 7, IRON);
  b.cyl(T(x, y + 1.3, z), 0.35, 0.3, 0.06, 7, EMBER);
  fires.push([x, y + 1.6, z]);
  cols.push({ x, z, r: 0.45 });
}
