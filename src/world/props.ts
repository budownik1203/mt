// Static scenery merged into one mesh: pines, dead trees, rocks, a ruined
// chapel, gallows with a crow cage, a bandit camp with a fire.
import { rng, clamp } from "../core/math.ts";
import { MeshBuilder, T, hex } from "../gfx/meshbuilder.ts";
import { height, roadDist, slope, WORLD, BF, WALL } from "./terrain.ts";

export interface Collider { x: number; z: number; r: number }
export interface Scenery { mesh: MeshBuilder; colliders: Collider[]; fires: [number, number, number][] }

const BARK = hex(0x3b2f26), BARK_D = hex(0x2a2420), PINE = hex(0x1f2b23), PINE_D = hex(0x18221c), STONE = hex(0x6d6a62), STONE_D = hex(0x55524b),
  WOOD = hex(0x4a3a2c), WOOD_D = hex(0x3e3024), IRON = hex(0x34363a), CLOTH = hex(0x5d5444), CLOTH_R = hex(0x5e2a24), BONE = hex(0xb5ab92), ASH = hex(0x2b2826), EMBER = hex(0xb4561e),
  SKIN = hex(0x7d6f62), SKIN_D = hex(0x5e544b), RAG = hex(0x3e3a33), RAG_R = hex(0x4a1f1a), MAILC = hex(0x56575a), POOL = hex(0x2a0b08), CHAR = hex(0x1b1817), CLOTH_K = hex(0x161414);

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

/** A body left where it fell: torso, head, limbs at odd angles, a dark pool under it. */
function corpse(b: MeshBuilder, x: number, z: number, r: () => number, cols: Collider[]) {
  const y = height(x, z), rot = r() * Math.PI * 2, c = Math.cos(rot), s = Math.sin(rot);
  const P = (lx: number, lz: number) => [x + lx * c + lz * s, z - lx * s + lz * c];
  const cloth = [RAG, RAG_R, MAILC, CLOTH, hex(0x2d3036)][Math.floor(r() * 5)];
  const at = (lx: number, ly: number, lz: number, ry: number, rx: number, rz: number) => { const [px, pz] = P(lx, lz); return T(px, y + ly, pz, rot + ry, rx, rz); };
  b.box(at(0, 0.02, 0.2, 0, 0, 0), 1.4 + r() * 0.6, 0.02, 1.2 + r() * 0.5, POOL);
  b.box(at(0, 0.12, 0, 0, Math.PI / 2, (r() - 0.5) * 0.4), 0.38, 0.62, 0.22, cloth);           // torso
  const headOff = r() < 0.2;                                                                // some lost their heads
  if (!headOff) b.rock(at(0, 0.12, 0.45 + r() * 0.05, 0, 0, 0), 0.11, SKIN_D, 0.15, Math.floor(r() * 99));
  else b.rock(at(0.9 + r(), 0.1, 0.7 + r(), 0, 0, 0), 0.11, SKIN_D, 0.2, Math.floor(r() * 99));
  for (const sd of [-1, 1]) {
    b.box(at(sd * 0.28, 0.08, 0.1 + r() * 0.2, sd * (0.4 + r() * 1.1), Math.PI / 2, 0), 0.1, 0.55, 0.1, cloth);  // arms flung out
    b.box(at(sd * 0.12, 0.09, -0.6, sd * r() * 0.5, Math.PI / 2, 0), 0.13, 0.8, 0.13, RAG);                       // legs
  }
  if (r() < 0.5) { const [ax, az] = P(0.05, 0.05); b.cyl(T(ax, y + 0.1, az, r() * 6, 0.4 + r() * 0.3, 0), 0.015, 0.015, 1 + r() * 0.5, 3, WOOD_D); } // spear or arrow in the back
  cols.push({ x, z, r: 0.25 });
}

/** A blade or spear stuck in the mud, a split shield beside it. */
function stuckWeapon(b: MeshBuilder, x: number, z: number, r: () => number) {
  const y = height(x, z);
  if (r() < 0.5) { b.box(T(x, y + 0.4, z, r() * 6, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), 0.05, 0.9, 0.012, hex(0x6b6e72)); b.box(T(x, y + 0.88, z, r() * 6), 0.22, 0.03, 0.03, IRON); }
  else b.cyl(T(x, y - 0.1, z, 0, (r() - 0.5) * 0.7, (r() - 0.5) * 0.7), 0.02, 0.018, 2.2, 4, WOOD_D);
  if (r() < 0.5) b.cyl(T(x + 0.6, y + 0.05, z + 0.3, r() * 6, 0.1, 1.45), 0.35, 0.35, 0.04, 6, r() < 0.5 ? RAG_R : WOOD_D);
}

/** A head on a stake by the road: a warning. */
function pike(b: MeshBuilder, x: number, z: number, r: () => number, cols: Collider[]) {
  const y = height(x, z);
  b.cyl(T(x, y - 0.2, z, 0, (r() - 0.5) * 0.15, (r() - 0.5) * 0.15), 0.06, 0.012, 2.9, 4, WOOD_D);
  b.rock(T(x, y + 2.55, z), 0.12, r() < 0.4 ? BONE : SKIN_D, 0.18, Math.floor(r() * 99));
  b.box(T(x, y + 2.35, z), 0.08, 0.25, 0.08, POOL);   // what ran down the stake
  cols.push({ x, z, r: 0.2 });
}

/** A gibbet with a hanged man. */
function gibbet(b: MeshBuilder, x: number, z: number, rot: number, r: () => number, cols: Collider[]) {
  const y = height(x, z), c = Math.cos(rot), s = Math.sin(rot);
  b.box(T(x, y + 2.2, z, rot), 0.22, 4.6, 0.22, WOOD_D);
  const ax = x + s * 1.0, az = z + c * 1.0;
  b.box(T(x + s * 0.5, y + 4.4, z + c * 0.5, rot), 0.18, 0.18, 1.3, WOOD_D);
  b.box(T(ax, y + 3.9, az), 0.02, 0.9, 0.02, hex(0x3a3328));                             // rope
  const sw = (r() - 0.5) * 0.2;
  b.rock(T(ax, y + 3.35, az + 0.02), 0.11, SKIN_D, 0.15, Math.floor(r() * 99));
  b.box(T(ax, y + 2.9, az, rot + sw, 0.1, 0), 0.34, 0.6, 0.2, RAG);
  for (const sd of [-1, 1]) {
    b.box(T(ax + sd * 0.2 * c, y + 2.85, az - sd * 0.2 * s, rot), 0.08, 0.55, 0.08, RAG);
    b.box(T(ax + sd * 0.08 * c, y + 2.2, az - sd * 0.08 * s, rot), 0.1, 0.8, 0.1, RAG);
  }
  cols.push({ x, z, r: 0.35 });
}

/** A tattered war banner on a leaning pole: black and red, torn into tongues. */
function banner(b: MeshBuilder, x: number, z: number, rot: number, r: () => number, cols: Collider[]) {
  const y = height(x, z), lean = (r() - 0.5) * 0.25;
  b.cyl(T(x, y - 0.2, z, 0, lean, 0), 0.04, 0.03, 4.6, 4, WOOD_D);
  const c = Math.cos(rot), s = Math.sin(rot), top = y + 4.2 + lean * 0;
  const col = r() < 0.5 ? CLOTH_K : RAG_R;
  const W = 1.1, H = 1.6, tongues = 4;
  const pt = (u: number, v: number) => [x + u * W * s + Math.sin(v * 3 + u * 2) * 0.06 * c, top - v * H, z + u * W * c - Math.sin(v * 3 + u * 2) * 0.06 * s];
  b.quad(pt(0, 0), pt(1, 0), pt(1, 0.6), pt(0, 0.6), col); b.quad(pt(0, 0), pt(0, 0.6), pt(1, 0.6), pt(1, 0), col);
  for (let i = 0; i < tongues; i++) {
    const u0 = i / tongues, u1 = (i + 1) / tongues, v = 0.6 + 0.25 + r() * 0.35;
    b.tri(pt(u0, 0.6), pt(u1, 0.6), pt((u0 + u1) / 2, v), col); b.tri(pt(u0, 0.6), pt((u0 + u1) / 2, v), pt(u1, 0.6), col);
  }
  b.box(T(x + s * W * 0.5, top + 0.02, z + c * W * 0.5, rot), 0.03, 0.03, W + 0.1, WOOD_D);
  cols.push({ x, z, r: 0.2 });
}

/** A burned-out cottage: blackened stone footing, charred posts, a fallen roof beam. */
function burnedHouse(b: MeshBuilder, x: number, z: number, rot: number, r: () => number, cols: Collider[], fires: [number, number, number][]) {
  const y = height(x, z), c = Math.cos(rot), s = Math.sin(rot);
  const P = (lx: number, lz: number) => [x + lx * c + lz * s, z - lx * s + lz * c];
  for (const [lx, lz, w, d] of [[0, -2.5, 6, 0.5], [0, 2.5, 6, 0.5], [-3, 0, 0.5, 5], [3, 0, 0.5, 5]] as const) {
    const [px, pz] = P(lx, lz), h = 0.6 + r() * 1.4;
    b.box(T(px, y + h / 2 - 0.2, pz, rot), w, h, d, r() < 0.5 ? CHAR : STONE_D);
    cols.push({ x: px, z: pz, r: Math.max(w, d) * 0.45 });
  }
  for (const [lx, lz] of [[-2.8, -2.3], [2.8, -2.3], [-2.8, 2.3], [2.8, 2.3], [0, -2.4]]) {
    const [px, pz] = P(lx, lz), h = 1.5 + r() * 2.2;
    b.box(T(px, y + h / 2, pz, rot, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3), 0.22, h, 0.22, CHAR);
  }
  const [bx, bz] = P(0.5, 0.4);
  b.box(T(bx, y + 1.0, bz, rot + 0.4, 0, 0.45), 0.25, 0.25, 6.5, CHAR);
  b.cyl(T(bx, y - 0.04, bz), 2.6, 2.4, 0.08, 8, ASH);
  b.box(T(bx + 0.6, y + 0.12, bz - 0.4, 0.7), 0.6, 0.15, 0.3, EMBER);
  fires.push([bx + 0.6, y + 0.5, bz - 0.4]);
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
  gibbet(b, x - 2.2, z + 0.4, rot, rng(31), cols);
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
  if (!BF.classic) return buildFieldFor();
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
    if (r() < 0.55) pine(b, x, z, s, r); else deadTree(b, x, z, s, r);
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
  // the aftermath of earlier battles: bodies, weapons in the mud, standards left behind
  for (let i = 0; i < 46; i++) {
    const a = r() * Math.PI * 2, d = 7 + Math.pow(r(), 0.8) * 42;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (slope(x, z) > 0.5) continue;
    corpse(b, x, z, r, cols);
    if (r() < 0.6) stuckWeapon(b, x + (r() - 0.5) * 3, z + (r() - 0.5) * 3, r);
  }
  for (let i = 0; i < 30; i++) { const a = r() * Math.PI * 2, d = 5 + r() * 45; stuckWeapon(b, Math.cos(a) * d, Math.sin(a) * d, r); }
  for (let i = 0; i < 7; i++) { const a = r() * Math.PI * 2, d = 14 + r() * 26; banner(b, Math.cos(a) * d, Math.sin(a) * d, r() * 6, r, cols); }
  // the road is lined with warnings
  for (let zz = -150; zz < 150; zz += 9 + r() * 10) {
    const cx = Math.sin(zz * 0.018) * 18 + Math.sin(zz * 0.05) * 4, side = r() < 0.5 ? -1 : 1;
    if (Math.abs(zz) < 12) continue;
    if (r() < 0.7) pike(b, cx + side * (5.5 + r()), zz, r, cols);
    else gibbet(b, cx + side * 6.5, zz, side > 0 ? -Math.PI / 2 : Math.PI / 2, r, cols);
  }
  burnedHouse(b, 38, -8, 0.3, r, cols, fires);
  burnedHouse(b, -40, 18, -0.8, r, cols, fires);
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

/** The curtain wall with a walkway, merlons, towers, a gate, two siege ladders and inner stairs. */
function siegeWorks(b: MeshBuilder, cols: Collider[], fires: [number, number, number][], r: () => number) {
  const Z = WALL.z, T0 = WALL.top, wz = (WALL.front + WALL.back) / 2 + Z, depth = WALL.front - WALL.back;
  const WOOD = hex(0x3a2c20), WOOD_D = hex(0x2a2018);
  for (let x = -WALL.half; x < WALL.half; x += 4) {
    const cx = x + 2;
    if (Math.abs(cx) < WALL.gate + 2) continue;
    const y = height(cx, Z);
    b.box(T(cx, y + T0 / 2 - 0.6, wz), 4.05, T0 + 1.2, depth + 0.2, r() < 0.5 ? STONE : STONE_D);
    for (const m of [-1.2, 1.2]) b.box(T(cx + m, y + T0 + 0.45, Z + WALL.front - 0.15), 0.9, 0.9, 0.35, STONE_D);   // merlons
    // the wall face blocks: no climbing except at the ladders (and nobody walks through the masonry)
    for (const dx of [-1.5, -0.5, 0.5, 1.5]) { const px = cx + dx; if (WALL.ladders.some((lx) => Math.abs(px - lx) < 1.1)) continue; cols.push({ x: px, z: Z + WALL.front + 0.25, r: 0.55 }); }
  }
  // gate towers and the gatehouse arch
  for (const sx of [-1, 1]) {
    const x = sx * (WALL.gate + 1.6), y = height(x, Z);
    b.box(T(x, y + T0 / 2 + 0.6, wz), 3.2, T0 + 3.6, depth + 1.4, STONE_D);
    b.cyl(T(x, y + T0 + 2.4, wz), 2.2, 0, 1.8, 4, hex(0x1a1716), false);
    for (let i = -1; i <= 1; i++) cols.push({ x: x + i * 1.0, z: Z + WALL.front + 0.6, r: 0.8 });
    fires.push([x, y + T0 + 1.5, Z + WALL.front + 1]);
  }
  b.box(T(0, height(0, Z) + T0 + 1.3, wz), WALL.gate * 2 + 0.2, 1.6, depth + 1.4, STONE);
  // towers at the ends
  for (const sx of [-1, 1]) { const x = sx * WALL.half, y = height(x, Z); b.box(T(x, y + T0, wz), 5, T0 * 2 + 1, 5, STONE_D); }
  // ladders leaning on the wall (outer side)
  for (const lx of WALL.ladders) {
    const y = height(lx, Z + WALL.front + 4.4), len = Math.hypot(4.4, T0 + 0.6), ang = Math.atan2(4.4, T0 + 0.6);
    for (const s of [-0.45, 0.45]) b.box(T(lx + s, y + (T0 + 0.6) / 2, Z + WALL.front + 2.2, 0, -ang, 0), 0.08, len, 0.08, WOOD);
    for (let k = 0; k < 9; k++) { const t = (k + 0.5) / 9; b.box(T(lx, y + t * (T0 + 0.6), Z + WALL.front + 4.4 * (1 - t)), 0.9, 0.05, 0.06, WOOD_D); }
  }
  // inner stairs (wooden steps)
  for (const sx of WALL.stairs) for (let k = 0; k < 7; k++) { const t = (k + 0.5) / 7, y = height(sx, Z + WALL.back - 5 * (1 - t)); b.box(T(sx, y + T0 * t - 0.15, Z + WALL.back - 5 * (1 - t)), 2.6, 0.3, 0.75, WOOD); }
}

/** A battlefield matching a spot on the campaign map: trees, rocks and water by biome, no old dead. */
function buildFieldFor(): Scenery {
  const b = new MeshBuilder();
  const cols: Collider[] = [];
  const fires: [number, number, number][] = [];
  const r = rng(1000 + BF.seed);
  const half = WORLD / 2 - 6, B = BF.biome;
  const inner = B === "forest" ? 12 : B === "swamp" ? 20 : 34;          // how close the trees come
  const dense = B === "forest" ? 1.6 : B === "swamp" ? 0.7 : B === "cursed" ? 0.6 : B === "hills" ? 0.5 : 0.8;
  const pineK = B === "forest" ? 0.8 : B === "swamp" ? 0.2 : B === "cursed" ? 0.05 : 0.6;
  let placed = 0;
  for (let i = 0; i < 4200 && placed < 700 * dense; i++) {
    const x = (r() - 0.5) * 2 * half, z = (r() - 0.5) * 2 * half, d = Math.hypot(x, z);
    if (d < inner || roadDist(x, z) < 6) continue;
    const ring = clamp((d - inner) / 50, 0, 1);
    if (r() > (ring * 0.9 + 0.08) * Math.min(1, dense)) continue;
    if (slope(x, z) > 0.8) continue;
    const s = 0.8 + r() * 0.7;
    if (r() < pineK) pine(b, x, z, s, r); else deadTree(b, x, z, s, r);
    if (d < 70) cols.push({ x, z, r: 0.35 * s });
    placed++;
  }
  // a few lone trees inside a forest clearing give cover
  if (B === "forest") for (let i = 0; i < 10; i++) { const a = r() * 6.28, d = 6 + r() * 8, x = Math.cos(a) * d, z = Math.sin(a) * d; pine(b, x, z, 0.9 + r() * 0.4, r); cols.push({ x, z, r: 0.4 }); }
  const rocks = B === "hills" ? 160 : 60;
  for (let i = 0; i < rocks; i++) {
    const x = (r() - 0.5) * 2 * half, z = (r() - 0.5) * 2 * half;
    if ((Math.abs(x) < 26 && Math.abs(z) < 34) || roadDist(x, z) < 4) continue;      // keep the fighting ground clear
    const s = 0.4 + r() * (B === "hills" ? 2.2 : 1.4);
    b.rock(T(x, height(x, z) + s * 0.2, z, r() * 6), s, r() < 0.5 ? STONE : STONE_D, 0.35, i);
    if (Math.hypot(x, z) < 70) cols.push({ x, z, r: s * 0.85 });
  }
  if (B === "cursed") for (let i = 0; i < 18; i++) { const a = r() * 6.28, d = 8 + r() * 35; corpse(b, Math.cos(a) * d, Math.sin(a) * d, r, cols); }
  if (B === "cursed" || r() < 0.3) for (let i = 0; i < 3; i++) { const a = r() * 6.28, d = 16 + r() * 20; pike(b, Math.cos(a) * d, Math.sin(a) * d, r, cols); }
  if (BF.siege) siegeWorks(b, cols, fires, r);
  return { mesh: b, colliders: cols, fires };
}
