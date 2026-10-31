// Base human: proportions, rig and three detail levels in the spirit of
// PS1 (early / late) and PS2. Each body part is a separate rigid mesh bound
// to one joint, exactly how most PS1-era characters were built.
import { Mat4, m4, mul, trs } from "../core/math.ts";
import { TMesh, Ring } from "./tmesh.ts";
import { REG, Region } from "./atlas.ts";

export type Level = "ps1a" | "ps1b" | "ps2";
export interface LevelSpec {
  id: Level; name: string; era: string;
  limb: number; torso: number; head: number; subdiv: boolean; smooth: boolean;
  tex: 1 | 2 | 4;                 // atlas downsample factor (256 / tex)
  res: number;                    // internal render height
  snap: boolean; affine: boolean; dither: boolean; bilinear: boolean;
  extras: boolean;                // nose, ears, thumbs
}
export const LEVELS: Record<Level, LevelSpec> = {
  ps1a: { id: "ps1a", name: "PS1 wczesne", era: "ok. 1996", limb: 4, torso: 6, head: 6, subdiv: false, smooth: false, tex: 4, res: 240, snap: true, affine: true, dither: true, bilinear: false, extras: false },
  ps1b: { id: "ps1b", name: "PS1 późne", era: "ok. 1999", limb: 6, torso: 8, head: 9, subdiv: false, smooth: true, tex: 2, res: 240, snap: true, affine: true, dither: true, bilinear: false, extras: true },
  ps2: { id: "ps2", name: "PS2", era: "ok. 2003", limb: 8, torso: 12, head: 14, subdiv: true, smooth: true, tex: 1, res: 448, snap: false, affine: false, dither: false, bilinear: true, extras: true },
};

export type Joint = "pelvis" | "torso" | "head" | "uarmL" | "farmL" | "handL" | "uarmR" | "farmR" | "handR" | "thighL" | "shinL" | "footL" | "thighR" | "shinR" | "footR";
const RIG: Record<Joint, { parent: Joint | null; at: [number, number, number] }> = {
  pelvis: { parent: null, at: [0, 0.93, 0] },
  torso: { parent: "pelvis", at: [0, 0.12, 0] },
  head: { parent: "torso", at: [0, 0.405, 0.005] },
  uarmL: { parent: "torso", at: [0.172, 0.35, 0] }, farmL: { parent: "uarmL", at: [0, -0.29, 0] }, handL: { parent: "farmL", at: [0, -0.26, 0] },
  uarmR: { parent: "torso", at: [-0.172, 0.35, 0] }, farmR: { parent: "uarmR", at: [0, -0.29, 0] }, handR: { parent: "farmR", at: [0, -0.26, 0] },
  thighL: { parent: "pelvis", at: [0.095, -0.05, 0] }, shinL: { parent: "thighL", at: [0, -0.43, 0] }, footL: { parent: "shinL", at: [0, -0.42, 0] },
  thighR: { parent: "pelvis", at: [-0.095, -0.05, 0] }, shinR: { parent: "thighR", at: [0, -0.43, 0] }, footR: { parent: "shinR", at: [0, -0.42, 0] },
};
export const JOINTS = Object.keys(RIG) as Joint[];

export interface Part { joint: Joint; mesh: TMesh }

/** Insert a slightly bulged midpoint ring between every pair (PS2 roundness). */
function sub(rings: Ring[]): Ring[] {
  const out: Ring[] = [];
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    out.push(a);
    const k = 1.025;
    out.push([(a[0] + b[0]) / 2, ((a[1] + b[1]) / 2) * k, ((a[2] + b[2]) / 2) * k, ((a[3] ?? 0) + (b[3] ?? 0)) / 2, ((a[4] ?? 0) + (b[4] ?? 0)) / 2]);
  }
  out.push(rings[rings.length - 1]);
  return out;
}

export function buildHuman(L: LevelSpec): { parts: Part[]; tris: number } {
  const parts: Part[] = [];
  const S = (r: Ring[]) => (L.subdiv ? sub(r) : r);
  const add = (joint: Joint, f: (t: TMesh) => void) => { const t = new TMesh(256); f(t); parts.push({ joint, mesh: t }); };
  const o = { smooth: L.smooth };
  const I = () => m4();

  add("pelvis", (t) => {
    t.loft(I(), S([[-0.11, 0.15, 0.1], [0, 0.165, 0.112], [0.12, 0.15, 0.1]]), L.torso, REG.pelvis, { ...o, capBot: true });
    // tunic skirt below the belt, open at the bottom
    t.loft(I(), S([[-0.26, 0.225, 0.17, 0, 0.005], [-0.08, 0.195, 0.14], [0.11, 0.168, 0.115]]), L.torso, REG.skirt, o);
    t.loft(I(), [[0.085, 0.17, 0.118], [0.135, 0.162, 0.112]], L.torso, REG.belt, o);
  });
  add("torso", (t) => {
    t.loft(I(), S([[0, 0.152, 0.102], [0.11, 0.168, 0.112, 0, 0.008], [0.22, 0.185, 0.122, 0, 0.014], [0.31, 0.19, 0.116, 0, 0.004], [0.38, 0.17, 0.102], [0.415, 0.115, 0.084], [0.44, 0.065, 0.062]]), L.torso, REG.torso, { ...o, capTop: true });
  });
  add("head", (t) => {
    t.loft(I(), S([[-0.02, 0.05, 0.05], [0.06, 0.053, 0.057, 0, 0.004], [0.085, 0.07, 0.08, 0, 0.012], [0.125, 0.082, 0.096, 0, 0.012], [0.17, 0.088, 0.1, 0, 0.008], [0.215, 0.091, 0.103], [0.255, 0.087, 0.099, 0, -0.005], [0.282, 0.073, 0.084, 0, -0.009], [0.3, 0.048, 0.056, 0, -0.011], [0.308, 0.018, 0.022, 0, -0.011]]), L.head, REG.head, { ...o, capTop: true });
    if (L.extras) {
      const nose: Region = { x: REG.head.x + 31, y: REG.head.y + 27, w: 2, h: 5 };
      t.box(trs(m4(), 0, 0.166, 0.1, 0, -0.22), 0.019, 0.045, 0.022, nose);
      const ear: Region = { x: REG.head.x + 15, y: REG.head.y + 25, w: 3, h: 8 };
      t.box(trs(m4(), 0.09, 0.175, -0.005, 0.25), 0.018, 0.05, 0.03, ear);
      t.box(trs(m4(), -0.09, 0.175, -0.005, -0.25), 0.018, 0.05, 0.03, ear);
    }
  });
  for (const s of ["L", "R"] as const) {
    const side = s === "L" ? 1 : -1;
    add(`uarm${s}`, (t) => t.loft(I(), S([[-0.3, 0.043, 0.043], [-0.16, 0.05, 0.05], [-0.04, 0.058, 0.056], [0.015, 0.052, 0.052], [0.045, 0.026, 0.03]]), L.limb, REG.uarm, { ...o, capTop: true }));
    add(`farm${s}`, (t) => t.loft(I(), S([[-0.27, 0.031, 0.029], [-0.16, 0.041, 0.04], [-0.05, 0.046, 0.044], [0.02, 0.042, 0.042]]), L.limb, REG.farm, o));
    add(`hand${s}`, (t) => {
      // palm faces the body (thin along X), fingers curl slightly
      t.loft(I(), [[-0.165, 0.012, 0.03, 0, 0.01], [-0.12, 0.016, 0.044, 0, 0.006], [-0.065, 0.021, 0.047], [-0.02, 0.02, 0.036], [0.01, 0.022, 0.03]], Math.max(4, L.limb - 2), REG.hand, { ...o, capBot: true });
      if (L.extras) t.loft(trs(m4(), -side * 0.004, -0.04, 0.036, 0, -0.35), [[-0.07, 0.01, 0.011], [0, 0.015, 0.015]], 4, REG.thumb, { ...o, capBot: true });
    });
    add(`thigh${s}`, (t) => t.loft(I(), S([[-0.44, 0.058, 0.06], [-0.3, 0.068, 0.074], [-0.12, 0.083, 0.09, 0, 0.004], [0.03, 0.085, 0.088]]), L.limb, REG.thigh, { ...o, capTop: true }));
    add(`shin${s}`, (t) => t.loft(I(), S([[-0.42, 0.044, 0.048], [-0.3, 0.052, 0.056], [-0.18, 0.057, 0.066, 0, -0.008], [-0.05, 0.054, 0.06], [0.02, 0.05, 0.054]]), L.limb, REG.shin, o));
    add(`foot${s}`, (t) => {
      const m = trs(m4(), 0, 0, 0, 0, Math.PI / 2);   // loft +Y becomes +Z (toes forward); ring oz becomes downward
      t.loft(m, [[-0.06, 0.042, 0.045, 0, 0.033], [0, 0.048, 0.05, 0, 0.028], [0.09, 0.052, 0.036, 0, 0.043], [0.17, 0.045, 0.022, 0, 0.055], [0.2, 0.028, 0.014, 0, 0.06]], Math.max(4, L.limb), REG.foot, { ...o, capTop: true, capBot: true });
    });
  }
  return { parts, tris: parts.reduce((a, p) => a + p.mesh.tris, 0) };
}

export type Pose = Partial<Record<Joint, [number, number, number]>>;   // [rx, ry, rz]

export function poseIdle(t = 0): Pose {
  const br = Math.sin(t * 1.6) * 0.015;
  return {
    torso: [br, 0, 0], head: [-br, 0, 0],
    uarmL: [0.04, 0, 0.13], farmL: [-0.18, 0, 0], handL: [0, 0, 0.05],
    uarmR: [0.04, 0, -0.13], farmR: [-0.18, 0, 0], handR: [0, 0, -0.05],
    thighL: [0, 0, 0.02], thighR: [0, 0, -0.02], shinL: [0.03, 0, 0], shinR: [0.03, 0, 0],
  };
}
export function poseT(): Pose {
  return { uarmL: [0, 0, Math.PI / 2], uarmR: [0, 0, -Math.PI / 2], handL: [0, 0, 0], handR: [0, 0, 0] };
}
export function poseWalk(t: number): Pose {
  const s = Math.sin(t * 5.2), c = Math.cos(t * 5.2);
  const leg = (ph: number) => {
    const sw = Math.sin(t * 5.2 + ph);
    const knee = Math.max(0, Math.cos(t * 5.2 + ph)) * 0.75 + 0.06;
    return { thigh: [-sw * 0.45, 0, 0] as [number, number, number], shin: [knee, 0, 0] as [number, number, number], foot: [-sw * 0.15 - 0.05, 0, 0] as [number, number, number] };
  };
  const l = leg(0), r = leg(Math.PI);
  return {
    pelvis: [0, s * 0.06, 0], torso: [0.05, -s * 0.09, 0], head: [-0.03, s * 0.05, 0],
    uarmL: [s * 0.42, 0, 0.1], farmL: [-0.3 - Math.max(0, s) * 0.3, 0, 0],
    uarmR: [-s * 0.42, 0, -0.1], farmR: [-0.3 - Math.max(0, -s) * 0.3, 0, 0],
    thighL: l.thigh, shinL: l.shin, footL: l.foot, thighR: r.thigh, shinR: r.shin, footR: r.foot,
    _bob: [Math.abs(c) * 0.035, 0, 0],
  } as Pose;
}

/** World matrix for every joint. */
export function solve(root: Mat4, pose: Pose): Record<Joint, Mat4> {
  const out = {} as Record<Joint, Mat4>;
  const bob = (pose as Record<string, [number, number, number]>)._bob?.[0] ?? 0;
  for (const j of JOINTS) {
    const r = RIG[j], a = pose[j] ?? [0, 0, 0];
    const local = trs(m4(), r.at[0], r.at[1] + (j === "pelvis" ? bob : 0), r.at[2], a[1], a[0], a[2]);
    out[j] = r.parent ? mul(m4(), out[r.parent], local) : mul(m4(), root, local);
  }
  return out;
}
