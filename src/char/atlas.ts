// Hand-painted (in code) 256x256 texture atlas for the base human, PS1/PS2 style.
// Every region is painted pixel by pixel on a 256 grid; lower detail levels
// downsample it to 128 or 64, the way old games shipped smaller textures.
import { rng } from "../core/math.ts";

export interface Region { x: number; y: number; w: number; h: number }
export const REG = {
  head: { x: 0, y: 0, w: 64, h: 64 },
  torso: { x: 64, y: 0, w: 64, h: 64 },
  skirt: { x: 128, y: 0, w: 64, h: 32 },
  belt: { x: 128, y: 32, w: 64, h: 8 },
  pelvis: { x: 128, y: 40, w: 64, h: 24 },
  uarm: { x: 192, y: 0, w: 32, h: 32 },
  farm: { x: 224, y: 0, w: 32, h: 32 },
  hand: { x: 192, y: 32, w: 32, h: 16 },
  thumb: { x: 224, y: 32, w: 16, h: 16 },
  thigh: { x: 0, y: 64, w: 32, h: 64 },
  shin: { x: 32, y: 64, w: 32, h: 64 },
  foot: { x: 64, y: 64, w: 32, h: 32 },
  sole: { x: 96, y: 64, w: 16, h: 16 },
  ground: { x: 128, y: 64, w: 64, h: 64 },
  blob: { x: 192, y: 64, w: 32, h: 32 },
  hair: { x: 224, y: 48, w: 32, h: 16 },
} satisfies Record<string, Region>;

type C = [number, number, number];
const hex = (h: number): C => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mixc = (a: C, b: C, t: number): C => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

export interface Look {
  skin: number; hair: number; tunic: number; trim: number; trousers: number; boots: number; belt: number;
  beard: boolean; scar: boolean;
}
export const BASE_LOOK: Look = { skin: 0xb88c6a, hair: 0x3a2a1e, tunic: 0x6b5a3e, trim: 0x5c2620, trousers: 0x4a4038, boots: 0x3a2b20, belt: 0x2e2219, beard: true, scar: true };

export function paintAtlas(look: Look = BASE_LOOK): ImageData {
  const S = 256;
  const img = new ImageData(S, S);
  const d = img.data;
  const r = rng(99);
  const set = (x: number, y: number, c: C, a = 255) => {
    if (x < 0 || y < 0 || x >= S || y >= S) return;
    const i = (Math.floor(y) * S + Math.floor(x)) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a;
  };
  const get = (x: number, y: number): C => { const i = (y * S + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const fill = (R: Region, f: (u: number, v: number, x: number, y: number) => C | null) => {
    for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) { const c = f(x, y, R.x + x, R.y + y); if (c) set(R.x + x, R.y + y, c); }
  };
  const n = (k = 0.08) => 1 + (r() - 0.5) * 2 * k;
  const shade = (c: C, k: number): C => [c[0] * k, c[1] * k, c[2] * k];
  const rect = (R: Region, x: number, y: number, w: number, h: number, c: C) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(R.x + x + i, R.y + y + j, c); };

  const skin = hex(look.skin), hair = hex(look.hair), tunic = hex(look.tunic), trim = hex(look.trim), trou = hex(look.trousers), boots = hex(look.boots), belt = hex(look.belt);
  const skinD = shade(skin, 0.78), skinL = shade(skin, 1.12);

  // ---------- HEAD (cylindrical wrap: u=0.5 is the face, v=0 top of skull) ----------
  // Face columns ~ 20..43. Mirror note: u grows from the character's left to right side as seen from the front.
  const H = REG.head;
  fill(H, (x, y) => {
    const fc = Math.abs(x - 31.5) / 32;           // 0 at face centre, 1 at back of head
    let c: C = mixc(skin, skinD, Math.min(1, fc * 1.6) * 0.5);
    // hair: cap over top, sides and back
    const hairline = 17 + fc * 2 + (fc > 0.35 && fc < 0.62 ? 6 : 0) - (fc > 0.62 ? (fc - 0.62) * 70 : 0);
    if (y < hairline) c = mixc(hair, shade(hair, 0.7), (r() < 0.3 ? 0.5 : 0));
    // ears
    if (Math.abs(fc - 0.5) < 0.06 && y > 24 && y < 34) c = skinD;
    // neck below jaw, shadowed
    if (y > 52) c = mixc(skinD, shade(skin, 0.62), (y - 52) / 12);
    return shade(c, n(0.04));
  });
  // brows, eyes, nose, mouth (face spans x≈21..42)
  const E = (x: number, y: number, c: C) => set(H.x + x, H.y + y, c);
  for (let i = 0; i < 6; i++) { E(23 + i, 22, hair); E(34 + i, 22, hair); }
  for (let i = 0; i < 5; i++) { E(24 + i, 23, shade(skin, 0.7)); E(35 + i, 23, shade(skin, 0.7)); }
  // eyes: white, iris, lid shadow
  const eye = (cx: number) => {
    for (let i = -2; i <= 2; i++) E(cx + i, 25, hex(0xcfc6b4));
    E(cx, 25, hex(0x2a2a30)); E(cx + (cx < 32 ? 1 : -1), 25, hex(0x46505a));
    for (let i = -2; i <= 2; i++) E(cx + i, 24, shade(skin, 0.55));
    for (let i = -1; i <= 1; i++) E(cx + i, 26, shade(skin, 0.75));
  };
  eye(26); eye(37);
  // nose: bridge highlight + shadow + nostrils
  for (let y = 25; y < 33; y++) { E(31, y, skinL); E(32, y, skinL); E(33, y, shade(skin, 0.82)); }
  E(30, 33, shade(skin, 0.6)); E(33, 33, shade(skin, 0.6)); E(31, 33, skinD); E(32, 33, skinD);
  // cheekbone shadows
  for (let y = 29; y < 37; y++) { E(23, y, shade(skin, 0.86)); E(40, y, shade(skin, 0.86)); }
  // mouth
  for (let i = 0; i < 8; i++) E(28 + i, 38, hex(0x5a2e26));
  for (let i = 1; i < 7; i++) E(28 + i, 39, shade(skin, 0.8));
  if (look.beard) {
    // short beard along the jaw, moustache, mouth left visible
    fill(H, (x, y, ax, ay) => {
      const fc = Math.abs(x - 31.5);
      const jaw = y >= 40 && y <= 51 && fc < 12.5 - Math.max(0, y - 46) * 1.1 && !(y <= 41 && fc < 4);
      const sideburn = y >= 28 && y < 40 && fc > 8.5 && fc < 12.5;
      const tache = (y === 36 || y === 37) && fc > 0.5 && fc < 6;
      if (!(jaw || sideburn || tache)) return null;
      const k = r() < 0.4 ? 0.75 : 1;
      return mixc(get(ax, ay), shade(hair, k), r() < 0.15 ? 0.5 : 0.82);
    });
  }
  if (look.scar) { for (let i = 0; i < 9; i++) E(37 - Math.floor(i / 3) + 0, 20 + i, hex(0x8a5a4a)); }

  // ---------- TORSO: tunic with neckline, shading, stitches ----------
  const TO = REG.torso;
  fill(TO, (x, y) => {
    const side = Math.abs(x - 31.5) / 32;     // 0 front centre .. 1 back centre
    let c = shade(tunic, (1 - side * 0.18) * n(0.05));
    if ((x + y * 3) % 7 === 0) c = shade(c, 0.92);           // weave
    if (y < 4) c = shade(c, 0.75);                          // shoulder line
    // front neckline (V) with trim
    const dx = Math.abs(x - 31.5);
    if (y < 9 && dx < 5 - y * 0.5) c = skinD;
    if (y < 10 && Math.abs(dx - (5 - y * 0.5)) < 1.1) c = trim;
    // chest fold shadows
    if (y > 16 && y < 20 && side < 0.3 && dx > 5) c = shade(c, 0.85);
    // side seams
    if (Math.abs(side - 0.5) < 0.02) c = shade(c, 0.7);
    // patch on the back
    if (side > 0.8 && y > 30 && y < 44 && x < 8) c = shade(hex(0x5b5a44), n(0.05));
    return c;
  });
  // ---------- SKIRT (tunic below the belt), hem trim ----------
  fill(REG.skirt, (x, y) => {
    let c = shade(tunic, (0.95 - Math.abs(x - 31.5) / 32 * 0.15) * n(0.05));
    if (x % 8 === 0) c = shade(c, 0.8);                     // folds
    if (y > 27) c = trim;
    if (y === 27) c = shade(trim, 0.7);
    return c;
  });
  fill(REG.belt, (x, y) => {
    let c = shade(belt, n(0.06));
    if (y === 0 || y === 7) c = shade(belt, 0.7);
    if (Math.abs(x - 31.5) < 3 && y > 1 && y < 6) c = (x === 30 || x === 33 || y === 2 || y === 5) ? hex(0x8a7a52) : shade(belt, 0.8); // buckle
    if (x % 9 === 4 && y === 4) c = hex(0x6f6655);
    return c;
  });
  fill(REG.pelvis, (x, y) => shade(trou, n(0.06) * (y < 4 ? 0.8 : 1)));

  // ---------- ARMS: sleeve on the upper arm, sleeve end + skin on the forearm ----------
  fill(REG.uarm, (x, y) => {
    let c = shade(tunic, (1 - Math.abs(x - 15.5) / 16 * 0.15) * n(0.05));
    if ((x + y * 3) % 7 === 0) c = shade(c, 0.92);
    if (x === 0 || x === 31) c = shade(c, 0.8);
    return c;
  });
  fill(REG.farm, (x, y) => {
    if (y < 10) { let c = shade(tunic, n(0.05)); if (y >= 8) c = trim; return c; }
    let c = shade(skin, (1 - Math.abs(x - 15.5) / 16 * 0.2) * n(0.04));
    if (y > 12 && r() < 0.04) c = shade(hair, 1.2);          // arm hair
    if (y > 27) c = skinD;                                  // wrist crease
    return c;
  });
  fill(REG.hand, (x, y) => {
    let c = shade(skin, n(0.04));
    if (y > 9 && x % 4 === 0) c = skinD;                    // finger gaps
    if (y > 13) c = shade(skin, 0.85);
    return c;
  });
  fill(REG.thumb, () => shade(skin, n(0.04)));

  // ---------- LEGS ----------
  fill(REG.thigh, (x, y) => {
    let c = shade(trou, (1 - Math.abs(x - 15.5) / 16 * 0.15) * n(0.05));
    if (x === 15 || x === 16) c = shade(c, 0.85);            // seam
    if (y > 56) c = shade(c, 0.9);
    return c;
  });
  fill(REG.shin, (x, y) => {
    const side = Math.abs(x - 15.5) / 16;
    // trousers top, wrapped puttees middle, boot below
    if (y < 14) return shade(trou, (1 - side * 0.15) * n(0.05));
    if (y < 34) { const band = (y + Math.floor(x / 4)) % 5 === 0; return shade(hex(0x6a6152), (band ? 0.75 : 1) * n(0.05)); }
    let c = shade(boots, (1 - side * 0.2) * n(0.05));
    if (y === 34 || y === 35) c = shade(boots, 0.7);
    if (y > 58) c = shade(boots, 0.75);
    if (side < 0.1 && y > 38 && y < 56 && y % 4 === 0) c = hex(0x5a4a3a); // laces
    return c;
  });
  fill(REG.foot, (x, y) => {
    let c = shade(boots, n(0.06));
    if (y > 26) c = shade(boots, 0.6);                      // welt
    if (y < 4) c = shade(boots, 1.15);
    return c;
  });
  fill(REG.sole, () => hex(0x1e1712));

  // ---------- HAIR (for the top cap) ----------
  fill(REG.hair, () => shade(hair, r() < 0.3 ? 0.75 : 1));

  // ---------- GROUND: trampled mud and dead grass ----------
  fill(REG.ground, (x, y) => {
    const k = r();
    let c: C = k < 0.5 ? hex(0x3f3426) : k < 0.8 ? hex(0x4a3d2c) : hex(0x35402a);
    if (k > 0.94) c = hex(0x5c5a3a);
    if ((x * 7 + y * 13) % 29 === 0) c = hex(0x2b241b);
    return c;
  });
  // ---------- BLOB SHADOW (alpha) ----------
  const B = REG.blob;
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
    const dd = Math.hypot(x - 15.5, y - 15.5) / 16;
    set(B.x + x, B.y + y, [10, 8, 6], Math.max(0, Math.min(255, (1 - dd) * 1.4 * 200)));
  }
  // everything else opaque
  for (let i = 3; i < d.length; i += 4) if (d[i] === 0 && !(i / 4 % S >= B.x && i / 4 % S < B.x + B.w && Math.floor(i / 4 / S) >= B.y && Math.floor(i / 4 / S) < B.y + B.h)) d[i] = 255;
  return img;
}

/** Box-filter downsample by an integer factor (2 or 4), like a smaller shipped texture. */
export function downsample(src: ImageData, f: number): ImageData {
  if (f === 1) return src;
  const S = src.width / f, out = new ImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const acc = [0, 0, 0, 0];
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const k = ((y * f + j) * src.width + (x * f + i)) * 4;
      for (let c = 0; c < 4; c++) acc[c] += src.data[k + c];
    }
    const o = (y * S + x) * 4;
    for (let c = 0; c < 4; c++) out.data[o + c] = acc[c] / (f * f);
  }
  return out;
}

/**
 * Grimdark wear over a painted atlas: colour drained, low-frequency soot and mud blotches,
 * and dried blood flecks in a few clusters. Alpha (cut-outs) is left untouched.
 */
export function grime(src: ImageData, seed = 5, blood = 0.6): ImageData {
  const S = src.width, d = new Uint8ClampedArray(src.data), r = rng(seed);
  const vn = (x: number, y: number, f: number, o: number) => Math.sin(x * f + o) * Math.cos(y * f * 1.3 + o * 1.7) + Math.sin((x + y) * f * 0.7 + o * 2.3) * 0.6;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    if (d[i + 3] < 8) continue;
    const g = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    const soot = Math.max(0, vn(x, y, 0.21, seed) * 0.5 + vn(x, y, 0.53, seed + 4) * 0.25);
    const k = (1 - soot * 0.24) * (0.97 + (r() - 0.5) * 0.08);
    for (let c = 0; c < 3; c++) {
      const v = d[i + c] * 0.72 + g * 0.28;                 // drain colour
      d[i + c] = v * k * (c === 2 ? 0.94 : 1);               // a little yellow-brown in the grime
    }
  }
  // dried blood: clustered flecks, darker in the middle
  const clusters = Math.floor(26 * blood);
  for (let n = 0; n < clusters; n++) {
    const cx = r() * S, cy = r() * S, rad = 2 + r() * 6;
    const drops = 10 + Math.floor(r() * 30);
    for (let m = 0; m < drops; m++) {
      const a = r() * Math.PI * 2, t = Math.pow(r(), 1.6) * rad;
      const x = Math.floor(cx + Math.cos(a) * t), y = Math.floor(cy + Math.sin(a) * t * 1.4 + r() * 3);
      if (x < 0 || y < 0 || x >= S || y >= S) continue;
      const i = (y * S + x) * 4;
      if (d[i + 3] < 8) continue;
      const w = 0.55 + 0.4 * (1 - t / rad);
      d[i] = d[i] * (1 - w) + 70 * w; d[i + 1] = d[i + 1] * (1 - w) + 12 * w; d[i + 2] = d[i + 2] * (1 - w) + 10 * w;
    }
  }
  return new ImageData(d, S, S);
}
