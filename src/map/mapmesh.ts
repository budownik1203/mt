// Geometry for the campaign map: faceted terrain coloured by biome (summer and
// winter versions), the river, bridges, settlements, woods, points of interest
// and the little figures that stand for parties.
import { rng, clamp, lerp } from "../core/math.ts";
import { MeshBuilder, T, hex, RGB } from "../gfx/meshbuilder.ts";
import { World, MAP, CELL, N, centerOf, cellIndex, Settlement, Poi } from "./world.ts";

const C = {
  fields: hex(0x4a4a2c), fieldsDry: hex(0x5d5636), forest: hex(0x2a3322), swamp: hex(0x2d3326), hills: hex(0x56544a),
  cursed: hex(0x2b2725), edge: hex(0x34322f), road: hex(0x7a664a), water: hex(0x34474c), snow: hex(0xb9bbb8), snowD: hex(0x8f9290),
  pine: hex(0x1d2a22), pineD: hex(0x17211b), bark: hex(0x2d241d), stone: hex(0x5e5a52), stoneD: hex(0x47443e), wood: hex(0x4a3a2b), woodD: hex(0x33281f),
  thatch: hex(0x6b5a3a), roof: hex(0x4d2a22), roofD: hex(0x3a2f2c), char: hex(0x1b1817), bone: hex(0xb3a991), red: hex(0x5e211b), black: hex(0x141313),
};
const mix = (a: RGB, b: RGB, t: number): RGB => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export function buildMapTerrain(w: World, winter: boolean): MeshBuilder {
  const b = new MeshBuilder(); b.jitter = 0.05;
  const H: number[][] = [];
  for (let i = 0; i <= N; i++) { H.push([]); for (let j = 0; j <= N; j++) H[i].push(w.height(-MAP / 2 + i * CELL, -MAP / 2 + j * CELL)); }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = cellIndex(i, j), bio = w.biome[k];
    const [cx, cz] = centerOf(i, j);
    let c: RGB = bio === "fields" ? mix(C.fields, C.fieldsDry, (Math.sin(cx * 0.21) * Math.cos(cz * 0.17) + 1) / 2) : C[bio];
    if (w.road[k]) c = mix(c, C.road, 0.25);
    if (w.river[k] && w.river[k] !== 3) c = mix(c, C.water, 0.6);
    if (winter && bio !== "edge") c = mix(w.road[k] ? C.snowD : C.snow, c, bio === "forest" ? 0.45 : 0.15);
    const x0 = -MAP / 2 + i * CELL, z0 = -MAP / 2 + j * CELL, x1 = x0 + CELL, z1 = z0 + CELL;
    const A = [x0, H[i][j], z0], B = [x1, H[i + 1][j], z0], Cc = [x1, H[i + 1][j + 1], z1], D = [x0, H[i][j + 1], z1];
    if ((i + j) % 2) { b.tri(A, D, Cc, c); b.tri(A, Cc, B, c); } else { b.tri(A, D, B, c); b.tri(B, D, Cc, c); }
  }
  return b;
}

export function buildMapFeatures(w: World, winter: boolean): MeshBuilder {
  const b = new MeshBuilder(); b.jitter = 0.08;
  const r = rng(91);
  const h = w.height;
  // river ribbon
  const wl = (x: number, z: number) => h(x, z) + 0.12;
  for (let i = 0; i < w.riverLine.length - 1; i++) {
    const [x0, z0] = w.riverLine[i], [x1, z1] = w.riverLine[i + 1];
    const wcol = winter ? hex(0x9aa3a6) : C.water;
    b.quad([x0 - 1.5, wl(x0, z0), z0], [x1 - 1.5, wl(x1, z1), z1], [x1 + 1.5, wl(x1, z1), z1], [x0 + 1.5, wl(x0, z0), z0], wcol);
  }
  // roads as ribbons laid over the ground
  for (const line of w.roadLines) for (let i = 0; i < line.length - 1; i++) {
    const [x0, z0] = line[i], [x1, z1] = line[i + 1];
    const dx = x1 - x0, dz = z1 - z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * 0.65, nz = dx / l * 0.65;
    const y0 = h(x0, z0) + 0.1, y1 = h(x1, z1) + 0.1;
    b.quad([x0 + nx, y0, z0 + nz], [x0 - nx, y0, z0 - nz], [x1 - nx, y1, z1 - nz], [x1 + nx, y1, z1 + nz], winter ? C.snowD : C.road);
  }
  // bridges where roads cross water; fords as stepping stones
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = cellIndex(i, j);
    if (w.river[k] === 3) { const [x, z] = centerOf(i, j); b.box(T(x, h(x, z) + 0.45, z), 2.2, 0.25, 2.2, C.woodD); }
  }
  for (const [fx, fz] of w.fords) for (let s = -2; s <= 2; s++) b.rock(T(fx + s * 0.7, wl(fx, fz) + 0.05, fz + (s % 2) * 0.4), 0.35, C.stoneD, 0.3, s + 9);
  // woods, swamps, hills, cursed land
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = cellIndex(i, j), bio = w.biome[k];
    if (w.road[k] || w.river[k]) continue;
    const [cx, cz] = centerOf(i, j);
    if (w.settlements.some((s) => Math.hypot(s.x - cx, s.z - cz) < (s.kind === "town" ? 9 : 6))) continue;
    if (bio === "forest") {
      const n = r() < 0.7 ? 2 : 1;
      for (let t = 0; t < n; t++) {
        const x = cx + (r() - 0.5) * CELL, z = cz + (r() - 0.5) * CELL, s = 0.7 + r() * 0.6, y = h(x, z);
        if (r() < 0.85) { b.cyl(T(x, y, z), 0.12 * s, 0.08 * s, 0.6 * s, 4, C.bark); b.cyl(T(x, y + 0.45 * s, z, r() * 3), 0.75 * s, 0, 1.9 * s, 5, winter ? mix(C.pine, C.snow, 0.35) : (r() < 0.5 ? C.pine : C.pineD), false); }
        else b.cyl(T(x, y, z, 0, (r() - 0.5) * 0.3), 0.1 * s, 0.03 * s, 1.8 * s, 4, C.bark);
      }
    } else if (bio === "swamp" && r() < 0.35) {
      const x = cx + (r() - 0.5) * CELL, z = cz + (r() - 0.5) * CELL;
      if (r() < 0.5) b.cyl(T(x, h(x, z), z, 0, (r() - 0.5) * 0.4), 0.1, 0.02, 1.4 + r(), 4, C.bark);
      else b.box(T(x, h(x, z) + 0.05, z, r() * 3), 1.6 + r(), 0.04, 1.2 + r(), winter ? hex(0x9aa3a6) : C.water);
    } else if (bio === "hills" && r() < 0.18) {
      const x = cx + (r() - 0.5) * CELL, z = cz + (r() - 0.5) * CELL;
      b.rock(T(x, h(x, z) + 0.2, z, r() * 6), 0.5 + r() * 0.8, r() < 0.5 ? C.stone : C.stoneD, 0.35, i * 7 + j);
    } else if (bio === "cursed" && r() < 0.3) {
      const x = cx + (r() - 0.5) * CELL, z = cz + (r() - 0.5) * CELL, y = h(x, z);
      if (r() < 0.6) b.cyl(T(x, y, z, 0, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5), 0.09, 0.02, 1.6 + r() * 0.8, 4, C.char);
      else b.rock(T(x, y + 0.05, z), 0.12, C.bone, 0.2, i + j);
    } else if (bio === "fields" && r() < 0.025) {
      const x = cx + (r() - 0.5) * CELL, z = cz + (r() - 0.5) * CELL;
      b.cyl(T(x, h(x, z), z), 0.1, 0.07, 0.5, 4, C.bark); b.cyl(T(x, h(x, z) + 0.4, z), 0.55, 0, 1.4, 5, winter ? mix(C.pine, C.snow, 0.35) : C.pine, false);
    }
  }
  for (const p of w.pois) poiModel(b, w, p);
  return b;
}

function hut(b: MeshBuilder, x: number, y: number, z: number, rot: number, s: number, burned: boolean, roof: RGB) {
  b.box(T(x, y + 0.35 * s, z, rot), 1.2 * s, 0.7 * s, 0.9 * s, burned ? C.char : C.wood);
  if (!burned) b.cyl(T(x, y + 0.7 * s, z, rot + Math.PI / 4), 0.95 * s, 0, 0.7 * s, 4, roof, false);
}

export function settlementModel(w: World, s: Settlement): MeshBuilder {
  const b = new MeshBuilder(); b.jitter = 0.08;
  const r = rng(s.x * 13 + s.z * 7 + 3), y = w.height(s.x, s.z);
  const roof = s.culture === "german" ? C.roof : s.culture === "church" ? C.roofD : C.thatch;
  if (s.kind === "village") {
    const n = 5 + Math.floor(s.pop / 60);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.4, d = 1.6 + r() * 2.2, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      hut(b, x, w.height(x, z), z, a + Math.PI / 2, 0.9 + r() * 0.3, s.burned, roof);
    }
    if (!s.burned) b.cyl(T(s.x, y, s.z), 0.12, 0.12, 1.6, 4, C.woodD);          // well-sweep / shrine pole
  } else if (s.kind === "town") {
    const R = 5.5, n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = s.x + Math.cos(a) * R, z = s.z + Math.sin(a) * R;
      b.box(T(x, w.height(x, z) + 0.8, z, -a), 2.0, 1.6, 0.45, s.burned ? C.char : C.stone);
      if (i % 3 === 0) b.cyl(T(x, w.height(x, z), z), 0.55, 0.5, 2.6, 6, C.stoneD);
    }
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, d = 1 + r() * 3.4, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      b.box(T(x, w.height(x, z) + 0.6, z, r() * 3), 1.0, 1.2 + r() * 0.8, 1.0, s.burned ? C.char : C.wood);
      if (!s.burned) b.cyl(T(x, w.height(x, z) + 1.4, z, r() * 3 + Math.PI / 4), 0.8, 0, 0.8, 4, roof, false);
    }
    // the church: nave and a tall spire (taller for Sankt Morwen)
    const sp = s.culture === "church" ? 5.5 : 3.6;
    b.box(T(s.x, y + 1, s.z, 0.3), 1.4, 2, 3, C.stoneD);
    b.box(T(s.x + 0.5, y + sp / 2, s.z - 1.2, 0.3), 0.9, sp, 0.9, C.stoneD);
    b.cyl(T(s.x + 0.5, y + sp, s.z - 1.2, 0.3 + Math.PI / 4), 0.7, 0, 1.6, 4, C.roofD, false);
  } else {
    // castle on its rise: keep, curtain wall, gate
    const R = 3.2;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4, x = s.x + Math.cos(a) * R, z = s.z + Math.sin(a) * R;
      b.cyl(T(x, w.height(x, z), z), 0.7, 0.62, 3, 6, C.stoneD);
      const a2 = a + Math.PI / 4, x2 = s.x + Math.cos(a2) * R * 0.8, z2 = s.z + Math.sin(a2) * R * 0.8;
      b.box(T(x2, w.height(x2, z2) + 1.1, z2, -a2 + Math.PI / 2), 3.6, 2.2, 0.5, C.stone);
    }
    b.box(T(s.x, y + 2.2, s.z, 0.4), 2, 4.4, 2, C.stoneD);
    b.box(T(s.x, y + 4.6, s.z, 0.4), 0.06, 1.6, 0.06, C.black);
    b.box(T(s.x + 0.4, y + 5.1, s.z, 0.4), 0.8, 0.5, 0.03, C.black);       // black banner
  }
  return b;
}

function poiModel(b: MeshBuilder, w: World, p: Poi) {
  const y = w.height(p.x, p.z), r = rng(p.x * 3 + p.z);
  if (p.kind === "hideout") {
    b.cyl(T(p.x, y, p.z, 0.3), 1.4, 0, 1.3, 5, C.woodD, false);
    b.cyl(T(p.x + 2, y, p.z + 0.8, 1), 1.1, 0, 1.0, 5, C.red, false);
    b.box(T(p.x + 0.6, y + 0.08, p.z - 1.2), 0.6, 0.16, 0.6, hex(0xb4561e));
    for (let i = 0; i < 3; i++) { b.cyl(T(p.x - 1.5 + i * 0.6, y, p.z - 2), 0.05, 0.01, 1.8, 4, C.woodD); b.rock(T(p.x - 1.5 + i * 0.6, y + 1.75, p.z - 2), 0.14, C.bone, 0.2, i); }
  } else if (p.kind === "ruin") {
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2, x = p.x + Math.cos(a) * 2.6, z = p.z + Math.sin(a) * 2.6; b.box(T(x, y + 0.5, z, -a), 1.6, 0.6 + r() * 1.6, 0.5, C.stoneD); }
  } else if (p.kind === "cursed") {
    b.box(T(p.x, y + 1.6, p.z), 0.4, 3.2, 0.4, C.black);
    b.rock(T(p.x, y + 3.3, p.z), 0.3, C.bone, 0.25, 5);
  } else if (p.kind === "gallows") {
    b.box(T(p.x, y + 1.6, p.z), 0.2, 3.2, 0.2, C.woodD); b.box(T(p.x + 0.6, y + 3.1, p.z), 1.4, 0.15, 0.15, C.woodD);
    b.box(T(p.x + 1.1, y + 2.4, p.z), 0.25, 0.7, 0.18, C.black);
  } else if (p.kind === "graveyard") {
    for (let i = 0; i < 9; i++) { const x = p.x + (i % 3) * 1.1 - 1.1, z = p.z + Math.floor(i / 3) * 1.1 - 1.1; b.box(T(x, y + 0.3, z, r() * 0.3, 0, (r() - 0.5) * 0.3), 0.5, 0.6, 0.12, C.stoneD); }
  }
}

/** Little standing figure with a banner for a party; colour by who they are. */
export function partyFigure(body: RGB, flag: RGB, big: boolean): MeshBuilder {
  const b = new MeshBuilder(); b.jitter = 0.06;
  const fig = (x: number, z: number, s: number) => {
    b.cyl(T(x, 0, z), 0.16 * s, 0.13 * s, 0.75 * s, 5, body);
    b.rock(T(x, 0.88 * s, z), 0.13 * s, hex(0x6d5c4c), 0.15, 3);
  };
  fig(0, 0, 1.25);
  if (big) { fig(-0.45, -0.35, 1); fig(0.45, -0.3, 1); }
  b.box(T(0.28, 0.9, 0), 0.04, 1.8, 0.04, hex(0x2d241d));
  b.box(T(0.55, 1.55, 0), 0.5, 0.42, 0.03, flag);
  return b;
}
export const clampMap = (v: number) => clamp(v, -MAP / 2 + 8, MAP / 2 - 8);
