// Heightfield terrain: rolling moor with a flattened killing field in the
// middle, a muddy road, and colour by slope and height.
import { fbm, clamp, lerp, smooth } from "../core/math.ts";
import { MeshBuilder, RGB, hex } from "../gfx/meshbuilder.ts";

export const WORLD = 360;           // metres per side
const CELL = 2.5;

const GRASS = hex(0x2c3320), GRASS_DRY = hex(0x4b4632), MUD = hex(0x2d241b), ROAD = hex(0x43362a), ROCK = hex(0x55534f), ROCK_D = hex(0x3c3a36), ASHC = hex(0x201d1b), GORE = hex(0x3b1b15);

export function roadDist(x: number, z: number) {
  // road snakes north-south through the field
  const cx = Math.sin(z * 0.018) * 18 + Math.sin(z * 0.05) * 4;
  return Math.abs(x - cx);
}

export function height(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let h = fbm(x * 0.006, z * 0.006, 5, 7) * 38 + fbm(x * 0.03, z * 0.03, 3, 11) * 3;
  h += Math.pow(clamp((r - 90) / 90, 0, 1), 1.6) * 30;          // hills ring the field
  const field = smooth(clamp((r - 35) / 55, 0, 1));
  h = lerp(fbm(x * 0.02, z * 0.02, 3, 5) * 1.6, h, field);        // flat-ish battlefield
  const rd = roadDist(x, z);
  if (rd < 5) h -= (1 - rd / 5) * 0.35;
  return h;
}

export function slope(x: number, z: number) {
  const e = 0.8;
  const dx = height(x + e, z) - height(x - e, z), dz = height(x, z + e) - height(x, z - e);
  return Math.hypot(dx, dz) / (2 * e);
}

function colourAt(x: number, z: number, y: number, s: number): RGB {
  const n = fbm(x * 0.05, z * 0.05, 3, 21) * 0.5 + 0.5;
  let c: RGB = [lerp(GRASS[0], GRASS_DRY[0], n), lerp(GRASS[1], GRASS_DRY[1], n), lerp(GRASS[2], GRASS_DRY[2], n)];
  // churned mud over the whole killing field, scorched earth where something burned
  const mud = clamp(fbm(x * 0.08, z * 0.08, 2, 33) * 2 + 0.15, 0, 1) * clamp(1.15 - Math.hypot(x, z) / 85, 0, 1);
  c = c.map((v, i) => lerp(v, MUD[i], mud * 0.85)) as RGB;
  const burn = clamp(fbm(x * 0.03, z * 0.03, 2, 71) * 3 - 0.9, 0, 1);
  c = c.map((v, i) => lerp(v, ASHC[i], burn * 0.8)) as RGB;
  const gore = clamp(fbm(x * 0.15, z * 0.15, 2, 91) * 3 - 1.1, 0, 1) * clamp(1 - Math.hypot(x, z) / 40, 0, 1);
  c = c.map((v, i) => lerp(v, GORE[i], gore * 0.7)) as RGB;
  const rd = roadDist(x, z);
  if (rd < 4.2) c = c.map((v, i) => lerp(ROAD[i], v, smooth(clamp(rd / 4.2, 0, 1)))) as RGB;
  const rock = clamp((s - 0.55) * 3, 0, 1);
  const rc = y > 25 ? ROCK : ROCK_D;
  c = c.map((v, i) => lerp(v, rc[i], rock)) as RGB;
  return c;
}

export function buildTerrain(): MeshBuilder {
  const b = new MeshBuilder();
  b.jitter = 0.035;
  const n = Math.round(WORLD / CELL), half = WORLD / 2;
  const H: number[][] = [];
  for (let i = 0; i <= n; i++) {
    H.push([]);
    for (let j = 0; j <= n; j++) H[i].push(height(-half + i * CELL, -half + j * CELL));
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const x0 = -half + i * CELL, z0 = -half + j * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
      const a = [x0, H[i][j], z0], bb = [x1, H[i + 1][j], z0], c = [x1, H[i + 1][j + 1], z1], d = [x0, H[i][j + 1], z1];
      const cx = x0 + CELL / 2, cz = z0 + CELL / 2;
      const ym = (a[1] + c[1]) / 2;
      const s = Math.abs(H[i + 1][j] - H[i][j]) / CELL + Math.abs(H[i][j + 1] - H[i][j]) / CELL;
      const col = colourAt(cx, cz, ym, s);
      if ((i + j) % 2) { b.tri(a, d, c, col); b.tri(a, c, bb, col); }
      else { b.tri(a, d, bb, col); b.tri(bb, d, c, col); }
    }
  // far skirt so the horizon never shows a hard edge
  return b;
}
