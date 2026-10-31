// Wearable gear: every piece is a separate rigid layer bound to a body joint,
// textured from its own 256x256 atlas. Pieces stack: gambeson -> mail -> surcoat -> plate.
import { m4, mul, trs, rng } from "../core/math.ts";
import { TMesh, Ring } from "./tmesh.ts";
import { Region } from "./atlas.ts";
import { LevelSpec, Joint, skirt } from "./human.ts";
import type { WeaponId } from "./weapons.ts";

export const GREG = {
  gamTorso: { x: 0, y: 0, w: 64, h: 64 }, gamSkirt: { x: 64, y: 0, w: 64, h: 32 }, gamArm: { x: 128, y: 0, w: 32, h: 32 }, gamCollar: { x: 160, y: 0, w: 32, h: 8 },
  mail: { x: 192, y: 0, w: 64, h: 64 }, mailFine: { x: 64, y: 32, w: 64, h: 32 }, mailHem: { x: 128, y: 32, w: 64, h: 8 },
  coif: { x: 0, y: 64, w: 64, h: 64 },
  kettle: { x: 64, y: 64, w: 64, h: 32 }, brim: { x: 64, y: 96, w: 64, h: 16 }, nasal: { x: 64, y: 112, w: 64, h: 16 },
  greathelm: { x: 128, y: 64, w: 64, h: 64 },
  surcoat: { x: 192, y: 64, w: 64, h: 64 }, surSkirt: { x: 128, y: 40, w: 64, h: 24 },
  plate: { x: 0, y: 128, w: 64, h: 64 }, plateLimb: { x: 64, y: 128, w: 32, h: 32 }, plateDark: { x: 96, y: 128, w: 32, h: 32 },
  shieldFront: { x: 128, y: 128, w: 64, h: 64 }, wood: { x: 192, y: 128, w: 32, h: 32 }, leather: { x: 224, y: 128, w: 32, h: 32 },
  blade: { x: 0, y: 192, w: 16, h: 64 }, brass: { x: 16, y: 192, w: 16, h: 16 }, grip: { x: 16, y: 208, w: 16, h: 16 }, steelDark: { x: 32, y: 192, w: 16, h: 16 },
  scabbard: { x: 48, y: 192, w: 16, h: 64 }, pouch: { x: 64, y: 192, w: 32, h: 32 }, rim: { x: 96, y: 192, w: 32, h: 8 }, gauntlet: { x: 96, y: 200, w: 32, h: 24 },
} satisfies Record<string, Region>;

type C = [number, number, number];
const hex = (h: number): C => [(h >> 16) & 255, (h >> 8) & 255, h & 255];

export function paintGear(): ImageData {
  const S = 256, img = new ImageData(S, S), d = img.data, r = rng(7);
  for (let i = 3; i < d.length; i += 4) d[i] = 255;
  const set = (x: number, y: number, c: C, a = 255) => { if (x < 0 || y < 0 || x >= S || y >= S) return; const i = (y * S + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; };
  const sh = (c: C, k: number): C => [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)];
  const n = (k = 0.06) => 1 + (r() - 0.5) * 2 * k;
  const fill = (R: Region, f: (x: number, y: number) => C | null) => { for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) { const c = f(x, y); if (c) set(R.x + x, R.y + y, c); } };
  const G = GREG;

  // --- gambeson: off-white linen, vertical quilting channels, stitch dots
  const linen = hex(0xa89a72);
  const quilt = (x: number, y: number, side: number): C => {
    const ch = x % 8, k = ch === 0 ? 0.86 : ch === 1 || ch === 7 ? 0.95 : 1.01;
    let c = sh(linen, k * (1 - side * 0.12) * n(0.04));
    if (ch === 0 && y % 4 === 1) c = sh(linen, 0.72);
    if (r() < 0.012) c = sh(hex(0x6b5a3a), 1);       // grime
    return c;
  };
  fill(G.gamTorso, (x, y) => { let c = quilt(x, y, Math.abs(x - 31.5) / 32); if (Math.abs(x - 31.5) < 1 && y > 4) c = hex(0x4a3c28); if (Math.abs(x - 31.5) < 3 && y % 8 === 4) c = hex(0x3a2e20); return c; }); // front lacing
  fill(G.gamSkirt, (x, y) => { let c = quilt(x, y, Math.abs(x - 31.5) / 32); if (y > 28) c = sh(linen, 0.7); return c; });
  fill(G.gamArm, (x, y) => quilt(x, y, Math.abs(x - 15.5) / 16));
  fill(G.gamCollar, (x, y) => sh(linen, (y === 0 || y === 7 ? 0.7 : 1) * n(0.04)));

  // --- mail: staggered rings, bright upper edge, dark gaps
  const ringPx = (x: number, y: number, scale: number): C => {
    const row = Math.floor(y / (2 * scale)), off = row % 2 ? 2 * scale : 0;
    const cx = (x + off) % (4 * scale), cy = y % (2 * scale);
    const edge = cx === 0 || cx === 4 * scale - 1;
    if (edge) return hex(0x24252a);
    if (cy === 0) return sh(hex(0xb7bcc4), n(0.08));
    if (cy === 2 * scale - 1) return hex(0x3d4047);
    return sh(hex(0x7d828b), n(0.1));
  };
  fill(G.mail, (x, y) => { const c = ringPx(x, y, 1); return r() < 0.01 ? hex(0x6e4a2e) : c; });   // a few rust specks
  fill(G.mailFine, (x, y) => ringPx(x, y, 1));
  fill(G.mailHem, (x, y) => (y < 3 ? ringPx(x, y, 1) : y < 6 ? sh(hex(0x8e8a7a), n(0.08)) : hex(0x2a2a2e)));    // brass ring hem
  // coif: mail with an open face (alpha cut), leather lining at the edge
  fill(G.coif, (x, y) => {
    const fx = Math.abs(x - 31.5);
    const face = fx < 11 && y > 17 && y < 51 - Math.max(0, fx - 6) * 1.2;
    if (face) return null;
    const edge = fx < 12.5 && y > 15.5 && y < 53 - Math.max(0, fx - 6) * 1.2;
    if (edge) return sh(hex(0x4a3524), n(0.08));
    return ringPx(x, y, 2);
  });
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const fx = Math.abs(x - 31.5);
    if (fx < 11 && y > 17 && y < 51 - Math.max(0, fx - 6) * 1.2) set(G.coif.x + x, G.coif.y + y, [0, 0, 0], 0);
  }

  // --- polished steel with a painted horizon reflection band
  const steel = (x: number, y: number, w: number, h: number): C => {
    const v = y / h, u = Math.abs(x / w - 0.5) * 2;
    let k = 0.62 + 0.25 * (1 - u);
    if (v > 0.32 && v < 0.42) k += 0.38;                // horizon band
    if (v > 0.42 && v < 0.48) k -= 0.18;                // dark ground reflection under it
    return sh(hex(0x737982), k * n(0.03));
  };
  // kettle hat dome: band of rivets at the rim
  fill(G.kettle, (x, y) => { let c = steel(x, y, 64, 32); if (x % 8 === 0) c = sh(c, 0.82); if (y > 26) c = sh(c, 0.75); if (y === 28 && x % 8 === 4) c = hex(0xe0e3e8); return c; });
  fill(G.brim, (x, y) => { let c = steel(x, y * 2, 64, 32); if (y < 2 || y > 13) c = sh(c, 0.7); return c; });
  // nasal helm: segmented spangenhelm with brass band
  fill(G.nasal, (x, y) => { let c = steel(x, y * 3, 64, 48); if (x % 16 < 2) c = hex(0x8a6b38); if (y > 12) c = hex(0x9a7a40); if (y > 12 && x % 6 === 3) c = hex(0xd8c070); return c; });
  // great helm: eye slit, breaths, brass cross
  fill(G.greathelm, (x, y) => {
    let c = steel(x, y, 64, 64);
    const fx = Math.abs(x - 31.5);
    if (fx < 1.5 && y > 12) c = hex(0x9a7a40);                                   // vertical brass strip
    if (y >= 24 && y <= 25 && fx < 14 && fx > 1.5) c = hex(0x0a0a0c);             // eye slit
    if ((y === 23 || y === 26) && fx < 15) c = hex(0x9a7a40);                       // brow band
    if (x > 34 && x < 44 && y > 34 && y < 48 && (x + y) % 4 === 0 && x % 2 === 0) c = hex(0x0a0a0c); // breaths (one side)
    if (y < 6) c = sh(c, 0.85);
    if (y > 60) c = sh(c, 0.6);
    if ((y === 8 || y === 58) && x % 5 === 2) c = hex(0xe8ebef);                  // rivets
    return c;
  });
  // plate: breastplate with medial ridge and edge rolls
  fill(G.plate, (x, y) => {
    const fx = Math.abs(x - 31.5);
    let c = steel(fx < 16 ? 32 - fx : 64 - fx, y, 64, 64);
    if (fx < 1) c = sh(hex(0xc8ced6), 1.05);                  // medial ridge highlight
    if (y < 3 || y > 60) c = sh(c, 0.7);                       // rolled edges
    if (y === 3 || y === 59) c = sh(hex(0xd3d8de), 1);
    if (fx > 26) c = sh(c, 0.8);                              // back plate a bit duller
    if ((y === 6 || y === 56) && x % 7 === 3) c = hex(0xe8ebef);
    if (r() < 0.006) c = hex(0x6a4a30);                       // battle wear
    return c;
  });
  fill(G.plateLimb, (x, y) => { let c = steel(x, y, 32, 32); if (y < 2 || y > 29) c = sh(c, 0.68); if ((y === 3 || y === 28) && x % 6 === 2) c = hex(0xe8ebef); return c; });
  fill(G.plateDark, (x, y) => sh(steel(x, y, 32, 32), 0.72));
  fill(G.gauntlet, (x, y) => { let c = steel(x, y * 1.3, 32, 32); if (y % 5 === 0) c = sh(c, 0.6); if (y > 18) c = sh(hex(0x4a3524), n(0.08)); return c; });

  // --- surcoat: black field, blood-red border, white raven on front (heraldry of the Raven Lord)
  const raven = ["................", ".....###........", "....#####.......", "..#######.......", "....######......", ".....#######....", ".....#########..", "....###########.", "....############", ".....#########..", "......######....", ".......####.....", "........#.#.....", ".......##.##....", "................", "................"];
  const field = hex(0x1d1b1f), red = hex(0x7d1a14), bone = hex(0xd9d2c0);
  fill(G.surcoat, (x, y) => {
    let c = sh(field, n(0.06) * (1 - Math.abs(x - 31.5) / 32 * 0.15));
    if (x % 10 === 0) c = sh(c, 0.75);                       // cloth folds
    if (Math.abs(x - 15.5) < 1 || Math.abs(x - 47.5) < 1) c = sh(red, 0.7);   // side seams (arm holes)
    const rx = Math.floor((x - 16) / 2), ry = Math.floor((y - 12) / 2);
    if (rx >= 0 && rx < 16 && ry >= 0 && ry < 16 && raven[ry][rx] === "#") c = sh(bone, n(0.05));
    if (y < 3) c = red;
    return c;
  });
  fill(G.surSkirt, (x, y) => { let c = sh(field, n(0.06)); if (x % 8 === 0) c = sh(c, 0.7); if (y > 19) c = red; if (Math.abs(x - 31.5) < 0.6) c = sh(field, 0.4); return c; });
  // shield front: same heraldry, painted, scratched, red border
  fill(G.shieldFront, (x, y) => {
    let c = sh(field, n(0.05));
    if (x < 4 || x > 59 || y < 4) c = red;
    const rx = Math.floor((x - 8) / 3), ry = Math.floor((y - 6) / 3);
    if (rx >= 0 && rx < 16 && ry >= 0 && ry < 16 && raven[ry][rx] === "#") c = sh(bone, n(0.05));
    if (r() < 0.02) c = sh(hex(0x6a5a44), 1);                 // chipped paint shows wood
    return c;
  });
  fill(G.wood, (x, y) => sh(hex(0x5a4128), (x % 5 === 0 ? 0.75 : 1) * n(0.06)));
  fill(G.leather, (x, y) => { let c = sh(hex(0x4e3624), n(0.08)); if (y % 8 === 0 && x % 2 === 0) c = hex(0x2e1f14); return c; });
  fill(G.blade, (x, y) => { const fx = Math.abs(x - 7.5); let c = sh(hex(0xc5cbd3), fx < 1 ? 0.72 : fx > 6 ? 1.15 : 0.95); if (y > 40 && y < 44) c = sh(c, 1.2); return c; });
  fill(G.brass, () => sh(hex(0x9c7c42), n(0.08)));
  fill(G.grip, (x, y) => (y % 3 === 0 ? hex(0x2a1d14) : sh(hex(0x4a3020), n(0.06))));
  fill(G.steelDark, () => sh(hex(0x4c5058), n(0.06)));
  fill(G.scabbard, (x, y) => { let c = sh(hex(0x3a2a1c), n(0.06)); if (y < 5 || y > 58) c = hex(0x8a6c3a); if (y % 16 === 8) c = hex(0x2a1d14); return c; });
  fill(G.pouch, (x, y) => { let c = sh(hex(0x5a3f28), n(0.08)); if (y < 10) c = sh(c, 0.8); if (y === 10) c = hex(0x2a1d14); if (Math.abs(x - 15.5) < 2 && y > 6 && y < 13) c = hex(0x9c7c42); return c; });
  fill(G.rim, () => sh(hex(0x5a5e66), n(0.06)));
  return img;
}

/** 16x16 repeating mail tile: 4 staggered rings across, bright tops, dark gaps. */
export function paintMailTile(): ImageData {
  const S = 16, img = new ImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const row = Math.floor(y / 2), off = row % 2 ? 2 : 0, cx = (x + off) % 4, cy = y % 2;
    let c = [118, 123, 132];
    if (cx === 0) c = [44, 46, 52]; else if (cy === 0) c = cx === 2 ? [178, 183, 190] : [138, 143, 151]; else c = cx === 3 ? [70, 73, 80] : [96, 100, 108];
    const i = (y * S + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return img;
}

export type Loadout = "base" | "levy" | "sergeant" | "knight" | "plate";
export interface LoadoutSpec { name: string; desc: string; weapon: WeaponId; shield: "none" | "arm" | "back"; scabbard: boolean }
export const LOADOUTS: Record<Loadout, LoadoutSpec> = {
  base: { name: "Chłop", desc: "tunika, owijacze, siekiera", weapon: "hatchet", shield: "none", scabbard: false },
  levy: { name: "Pachołek", desc: "przeszywanica, kapalin, sakwa, nóż, włócznia oburącz", weapon: "spear", shield: "none", scabbard: false },
  sergeant: { name: "Zbrojny", desc: "przeszywanica, kolczuga, czepiec, szyszak z nosalem, miecz, pochwa, tarcza na plecach", weapon: "sword", shield: "back", scabbard: true },
  knight: { name: "Rycerz", desc: "przeszywanica (pod spodem), kolczuga, czepiec, wappenrock, hełm garnczkowy, nakolanniki, nagolenniki, rękawice, miecz i tarcza", weapon: "sword", shield: "arm", scabbard: true },
  plate: { name: "Zbrojny w płytach", desc: "kolczuga, napierśnik z fartuchem, naramienniki, zarękawia, nałokietniki, nabiodrki, nagolenniki, rękawice, kapalin, buzdygan", weapon: "mace", shield: "none", scabbard: false },
};

const inflate = (rings: Ring[], k: number, kz = k): Ring[] => rings.map((r) => [r[0], r[1] + k, r[2] + kz, r[3], r[4]]);

/** Body cross-sections the gear is shaped around (match human.ts). */
const TORSO: Ring[] = [[0, 0.152, 0.102], [0.11, 0.168, 0.112, 0, 0.008], [0.22, 0.185, 0.122, 0, 0.014], [0.31, 0.19, 0.116, 0, 0.004], [0.38, 0.17, 0.102], [0.415, 0.115, 0.084]];
const UARM: Ring[] = [[-0.3, 0.043, 0.043], [-0.16, 0.05, 0.05], [-0.04, 0.058, 0.056], [0.015, 0.052, 0.052], [0.045, 0.026, 0.03]];
const FARM: Ring[] = [[-0.27, 0.031, 0.029], [-0.16, 0.041, 0.04], [-0.05, 0.046, 0.044], [0.02, 0.042, 0.042]];
const HEAD: Ring[] = [[-0.02, 0.05, 0.05], [0.06, 0.053, 0.057, 0, 0.004], [0.085, 0.07, 0.08, 0, 0.012], [0.125, 0.082, 0.096, 0, 0.012], [0.17, 0.088, 0.1, 0, 0.008], [0.215, 0.091, 0.103], [0.255, 0.087, 0.099, 0, -0.005], [0.282, 0.073, 0.084, 0, -0.009], [0.3, 0.048, 0.056, 0, -0.011], [0.308, 0.018, 0.022, 0, -0.011]];

export interface GearPiece { joint: Joint; mesh: TMesh; tex: number }
/** Returns gear meshes plus which body parts they fully cover (so the body is not drawn under them). */
export function buildGear(L: LevelSpec, lo: Loadout): { pieces: GearPiece[]; hide: Set<string>; gauntlets: boolean } {
  const out: GearPiece[] = [];
  const hide = new Set<string>();
  const sub = (rings: Ring[]): Ring[] => {
    if (!L.subdiv) return rings;
    const o: Ring[] = [];
    for (let i = 0; i < rings.length - 1; i++) { const a = rings[i], b = rings[i + 1]; o.push(a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 * 1.02, (a[2] + b[2]) / 2 * 1.02, ((a[3] ?? 0) + (b[3] ?? 0)) / 2, ((a[4] ?? 0) + (b[4] ?? 0)) / 2]); }
    o.push(rings[rings.length - 1]); return o;
  };
  const piece = (joint: Joint, f: (t: TMesh) => void, tex = 1) => { const t = new TMesh(256); f(t); out.push({ joint, mesh: t, tex }); };
  const mailP = (joint: Joint, f: (t: TMesh) => void) => piece(joint, (t) => { t.mat = 1; f(t); }, 2);
  const sk = (rings: Ring[], R: Region, o: Record<string, unknown>, tex = 1, mat = 0) => skirt((j, f) => piece(j, f, tex), rings, L.torso, R, o, mat);
  const sm = { smooth: L.smooth };
  const I = () => m4();
  const has = {
    gam: lo === "levy" || lo === "sergeant" || lo === "knight",
    gamShow: lo === "levy" || lo === "sergeant",
    mail: lo === "sergeant" || lo === "knight" || lo === "plate",
    coif: lo === "sergeant" || lo === "knight",
    sur: lo === "knight",
    plate: lo === "plate",
    legs: lo === "knight" || lo === "plate",
    gaunt: lo === "plate" || lo === "knight",
  };
  // layer offsets over the body (metres); each one clears the layer below
  const kG = 0.022, kM = has.gam ? 0.038 : 0.02, kS = kM + 0.014;

  if (has.gamShow) {
    hide.add("torso"); hide.add("uarm"); hide.add("farm"); hide.add("skirt");
    piece("torso", (t) => {
      t.loft(I(), sub(inflate(TORSO, kG, kG * 0.9)), L.torso, GREG.gamTorso, sm);
      if (!has.coif) t.loft(I(), [[0.4, 0.112, 0.09], [0.47, 0.088, 0.08]], L.torso, GREG.gamCollar, sm);   // stand collar
    });
    if (has.gamShow) sk(sub([[-0.4, 0.25, 0.195, 0, 0.01], [-0.22, 0.232, 0.178], [-0.04, 0.205, 0.15], [0.12, 0.178, 0.124]]), GREG.gamSkirt, sm);
    for (const s of ["L", "R"] as const) {
      piece(`uarm${s}`, (t) => t.loft(I(), sub(inflate(UARM, kG)), L.limb, GREG.gamArm, { ...sm, capTop: true }));
      piece(`farm${s}`, (t) => t.loft(I(), sub(inflate(FARM, kG * 0.8)), L.limb, GREG.gamArm, sm));
    }
  }
  if (has.mail) {
    hide.add("torso"); hide.add("uarm"); hide.add("farm"); hide.add("skirt");
    const len = has.gamShow ? -0.3 : -0.36;
    mailP("torso", (t) => t.loft(I(), sub(inflate(TORSO, kM, kM * 0.9)), L.torso, GREG.mail, { ...sm, tile: [12, 5] }));
    const skR: Ring[] = has.gamShow ? [[len, 0.262, 0.205, 0, 0.01], [-0.1, 0.232, 0.178], [0.12, 0.196 + 0.004, 0.14]] : [[len, 0.25, 0.19, 0, 0.01], [-0.1, 0.215, 0.162], [0.12, 0.185, 0.13]];
    sk(sub(skR), GREG.mail, { ...sm, tile: [7, 5] }, 2, 1);
    const hem = skR[0];
    sk([[len - 0.012, hem[1] + 0.006, hem[2] + 0.006, 0, 0.01], [len + 0.014, hem[1] + 0.003, hem[2] + 0.003, 0, 0.01]], GREG.mailHem, sm, 1, 2);
    for (const s of ["L", "R"] as const) {
      mailP(`uarm${s}`, (t) => t.loft(I(), sub(inflate(UARM, kM)), L.limb, GREG.mailFine, { ...sm, capTop: true, tile: [5, 4] }));
      mailP(`farm${s}`, (t) => t.loft(I(), sub(inflate(FARM, kM * 0.75)), L.limb, GREG.mailFine, { ...sm, tile: [4, 4] }));
    }
  }
  const coifK = 0.013;
  if (has.coif) {
    hide.add("ears");
    if (lo !== "knight") mailP("head", (t) => t.loft(I(), sub(inflate(HEAD.slice(0, -1), coifK, coifK).concat([[0.322, 0.03, 0.035, 0, -0.01]])), L.head, GREG.coif, { ...sm, capTop: true }));
    // mantle over the shoulders, wider than the hauberk so it never sinks in
    mailP("torso", (t) => t.loft(I(), sub([[0.29, 0.19 + kM + 0.018, 0.116 + kM + 0.02], [0.36, 0.175 + kM + 0.016, 0.108 + kM + 0.016], [0.42, 0.12 + kM, 0.094 + kM * 0.8], [0.48, 0.068, 0.074]]), L.torso, GREG.mailFine, { ...sm, tile: [12, 2] }));
  }
  if (has.sur) {
    piece("torso", (t) => t.loft(I(), sub(inflate(TORSO.slice(0, 5), kS, kS * 0.9).concat([[0.4, 0.15 + kS * 0.5, 0.1 + kS * 0.5]])), L.torso, GREG.surcoat, sm));
    sk(sub([[-0.47, 0.3, 0.245, 0, 0.015], [-0.2, 0.264, 0.212], [0.12, 0.2 + 0.01, 0.152]]), GREG.surSkirt, sm);
    piece("pelvis", (t) => t.loft(I(), [[0.08, 0.212, 0.162], [0.12, 0.208, 0.158]], L.torso, GREG.leather, sm));   // sword belt over the surcoat
  } else if (lo === "sergeant") {
    piece("pelvis", (t) => t.loft(I(), [[0.08, 0.205, 0.15], [0.12, 0.202, 0.147]], L.torso, GREG.leather, sm));
  }
  if (has.plate) {
    // breastplate + backplate shaped over the mail, keel forward
    const kP = kM + 0.02;
    piece("torso", (t) => {
      t.mat = 2;
      t.loft(I(), sub([[0.02, 0.152 + kP, 0.102 + kP, 0, 0.014], [0.12, 0.168 + kP, 0.112 + kP + 0.012, 0, 0.026], [0.22, 0.185 + kP, 0.122 + kP + 0.012, 0, 0.032], [0.31, 0.19 + kP, 0.116 + kP, 0, 0.014], [0.37, 0.17 + kP * 0.8, 0.102 + kP * 0.8], [0.405, 0.12 + kP * 0.4, 0.09 + kP * 0.4]]), L.torso, GREG.plate, sm);
    });
    // fauld: three lames, each wider than the one above
    for (let i = 0; i < 3; i++) {
      const y = 0.06 - i * 0.065;
      piece("pelvis", (t) => { t.mat = 2; t.loft(I(), [[y - 0.07, 0.226 + i * 0.01, 0.174 + i * 0.01, 0, 0.014], [y, 0.214 + i * 0.01, 0.162 + i * 0.01, 0, 0.014]], L.torso, GREG.plateLimb, sm); });
    }
  }
  for (const s of ["L", "R"] as const) {
    const side = s === "L" ? 1 : -1;
    if (has.plate) {
      piece(`uarm${s}`, (t) => { t.mat = 2; t.loft(I(), sub([[-0.14, 0.096, 0.092, side * 0.012], [-0.06, 0.104, 0.1, side * 0.014], [0.01, 0.1, 0.096, side * 0.01], [0.065, 0.07, 0.068, side * 0.004], [0.095, 0.02, 0.02]]), L.limb, GREG.plateLimb, { ...sm, capTop: true }); });
      piece(`farm${s}`, (t) => {
        t.mat = 2;
        t.loft(I(), sub([[-0.25, 0.058, 0.056], [-0.13, 0.07, 0.068], [-0.04, 0.074, 0.072]]), L.limb, GREG.plateLimb, sm);
        t.loft(I(), [[-0.035, 0.08, 0.08, 0, -0.012], [0.03, 0.084, 0.082, 0, -0.016], [0.065, 0.034, 0.034, 0, -0.016]], L.limb, GREG.plateDark, { ...sm, capTop: true });  // couter
      });
      piece(`thigh${s}`, (t) => { t.mat = 2; t.loft(I(), sub([[-0.38, 0.072, 0.08, 0, 0.006], [-0.2, 0.09, 0.1, 0, 0.008], [-0.08, 0.1, 0.106, 0, 0.008]]), L.limb, GREG.plateLimb, sm); });
    }
    if (has.legs) {
      piece(`shin${s}`, (t) => {
        t.mat = 2;
        t.loft(I(), sub([[-0.37, 0.062, 0.066, 0, 0.004], [-0.18, 0.074, 0.086, 0, 0.004], [-0.05, 0.07, 0.08, 0, 0.006]]), L.limb, GREG.plateLimb, sm);
        t.loft(I(), [[-0.045, 0.078, 0.078, 0, 0.018], [0.03, 0.086, 0.086, 0, 0.022], [0.085, 0.044, 0.05, 0, 0.018]], L.limb, GREG.plateDark, { ...sm, capTop: true });  // poleyn
      });
    }
    if (has.gaunt) {
      hide.add("hand" + s);
      piece(`hand${s}`, (t) => {
        t.mat = 2;
        t.loft(I(), [[-0.12, 0.03, 0.058, 0, 0.004], [-0.09, 0.036, 0.062], [-0.045, 0.034, 0.058], [-0.005, 0.03, 0.046], [0.03, 0.05, 0.056], [0.05, 0.054, 0.058]], Math.max(5, L.limb - 1), GREG.gauntlet, { ...sm, capBot: true });
      });
    }
  }
  // --- helmets (sized to sit over the coif when one is worn)
  const hb = has.coif ? coifK + 0.014 : 0.012;
  if (lo === "levy" || lo === "plate") piece("head", (t) => {
    t.mat = 2;
    t.loft(I(), sub([[0.19, 0.09 + hb, 0.102 + hb, 0, -0.002], [0.25, 0.088 + hb, 0.1 + hb, 0, -0.005], [0.3, 0.062 + hb, 0.072 + hb, 0, -0.01], [0.33 + hb * 0.6, 0.026, 0.03, 0, -0.01], [0.338 + hb * 0.6, 0.004, 0.004, 0, -0.01]]), L.head, GREG.kettle, { ...sm, capTop: true });
    t.loft(I(), [[0.165, 0.2, 0.21, 0, -0.004], [0.2, 0.094 + hb, 0.106 + hb, 0, -0.004]], L.head, GREG.brim, sm);
  });
  if (lo === "sergeant") piece("head", (t) => {
    t.mat = 2;
    t.loft(I(), sub([[0.2, 0.09 + hb, 0.102 + hb, 0, -0.002], [0.25, 0.087 + hb, 0.099 + hb, 0, -0.005], [0.3, 0.058 + hb, 0.068 + hb, 0, -0.01], [0.35 + hb, 0.022, 0.026, 0, -0.012], [0.372 + hb, 0.003, 0.003, 0, -0.012]]), L.head, GREG.nasal, { ...sm, capTop: true });
    t.box(trs(m4(), 0, 0.165, 0.103 + hb + 0.008, 0, -0.08), 0.02, 0.085, 0.008, GREG.steelDark);    // nasal
  });
  if (lo === "knight") {
    hide.add("head");
    piece("head", (t) => {
      t.mat = 2;
      t.loft(I(), sub([[-0.005, 0.118, 0.13, 0, 0.006], [0.12, 0.124, 0.137, 0, 0.008], [0.25, 0.121, 0.133, 0, 0.004], [0.318, 0.108, 0.12], [0.345, 0.074, 0.082], [0.353, 0.004, 0.004]]), L.head, GREG.greathelm, { ...sm, capTop: true });
    });
  }
  // --- equipment carried on the body
  if (lo === "levy") piece("pelvis", (t) => {
    t.box(trs(m4(), 0.205, 0.0, 0.1, 0.6), 0.09, 0.1, 0.045, GREG.pouch);
    t.mat = 2; t.box(trs(m4(), -0.21, -0.04, 0.06, -0.3, 0, -0.15), 0.012, 0.16, 0.03, GREG.blade);
    t.mat = 0; t.box(trs(m4(), -0.21, 0.07, 0.07, -0.3, 0, -0.15), 0.025, 0.08, 0.025, GREG.grip);
  });
  if (LOADOUTS[lo].scabbard) piece("pelvis", (t) => {
    const r = has.sur ? 0.225 : 0.215;
    const m = trs(m4(), r, 0.08, 0.05, 0.15, 0.38, 0.26);
    const at = (x: number, y: number, z: number) => mul(m4(), m, trs(m4(), x, y, z));
    t.box(at(0, -0.32, 0), 0.03, 0.64, 0.05, GREG.scabbard);
    t.mat = 2; t.box(at(0, -0.63, 0), 0.034, 0.03, 0.054, GREG.brass); t.box(at(0, -0.02, 0), 0.034, 0.03, 0.056, GREG.brass);
    t.mat = 0; t.box(at(0.0, 0.0, 0.0), 0.02, 0.015, 0.11, GREG.leather);   // hanger strap
  });
  return { pieces: out, hide, gauntlets: has.gaunt };
}
