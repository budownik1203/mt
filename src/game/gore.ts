// Hit locations from the actual blade position, dismemberment and gibs.
import { Mat4, m4, mul, trs, xform, invert } from "../core/math.ts";
import { Joint } from "../char/human.ts";
import { GMesh } from "../char/psx.ts";

type V = [number, number, number];
export type Zone = "head" | "body" | "arm" | "legs";

/** Capsules in joint space: [joint, from, to, radius, zone]. */
const CAPS: [Joint, V, V, number, Zone][] = [
  ["head", [0, 0, 0], [0, 0.29, 0.01], 0.11, "head"],
  ["torso", [0, 0.02, 0], [0, 0.4, 0], 0.16, "body"],
  ["pelvis", [0, -0.16, 0], [0, 0.08, 0], 0.15, "body"],
  ["uarmL", [0, 0, 0], [0, -0.28, 0], 0.055, "arm"], ["uarmR", [0, 0, 0], [0, -0.28, 0], 0.055, "arm"],
  ["farmL", [0, 0, 0], [0, -0.33, 0], 0.05, "arm"], ["farmR", [0, 0, 0], [0, -0.33, 0], 0.05, "arm"],
  ["thighL", [0, 0, 0], [0, -0.43, 0], 0.08, "legs"], ["thighR", [0, 0, 0], [0, -0.43, 0], 0.08, "legs"],
  ["shinL", [0, 0, 0], [0, -0.42, 0], 0.06, "legs"], ["shinR", [0, 0, 0], [0, -0.42, 0], 0.06, "legs"],
];

function segDist(p: V, a: V, b: V) {
  const ab: V = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap: V = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / l2));
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
}

/**
 * Which body part the blade meets. The blade (from the attacker's last frame) is slid
 * forward along the attacker's facing until its leading point reaches the target, so
 * overheads land on heads and shoulders, level cuts on torsos and arms, low aim on legs.
 */
export function locateHit(blade: Mat4, tip: number, attFwd: V, attPos: V, tgtJ: Record<Joint, Mat4>, tgtPos: V, aimY: number): { joint: Joint; zone: Zone; point: V } {
  const pts: V[] = [];
  for (let s = 0.15; s <= tip; s += 0.06) pts.push(xform(blade, 0, 0, s) as V);
  // leading point: furthest along the attacker's facing
  let lead = pts[0], best = -1e9;
  for (const p of pts) { const f = (p[0] - attPos[0]) * attFwd[0] + (p[2] - attPos[2]) * attFwd[2]; if (f > best) { best = f; lead = p; } }
  const dist = (tgtPos[0] - attPos[0]) * attFwd[0] + (tgtPos[2] - attPos[2]) * attFwd[2];
  const shift = Math.max(0, dist - best);
  const moved = pts.map((p) => [p[0] + attFwd[0] * shift, p[1] + aimY, p[2] + attFwd[2] * shift] as V);
  let bj: Joint = "torso", bz: Zone = "body", bd = 1e9, bp: V = moved[0];
  for (const [j, a, b, r, z] of CAPS) {
    const M = tgtJ[j];
    const A = xform(M, ...a) as V, B = xform(M, ...b) as V;
    for (const p of moved) { const d = segDist(p, A, B) - r; if (d < bd) { bd = d; bj = j; bz = z; bp = p; } }
  }
  return { joint: bj, zone: bz, point: bp };
}

/** Joints that come off together when a part is severed, and where the stump is (parent joint space). */
export const SEVER: Partial<Record<Joint, { chain: Joint[]; parent: Joint; at: V; dir: V }>> = {
  head: { chain: ["head"], parent: "torso", at: [0, 0.43, 0.005], dir: [0, 1, 0] },
  uarmL: { chain: ["uarmL", "farmL", "handL"], parent: "torso", at: [0.172, 0.35, 0], dir: [1, 0.2, 0] },
  uarmR: { chain: ["uarmR", "farmR", "handR"], parent: "torso", at: [-0.172, 0.35, 0], dir: [-1, 0.2, 0] },
  farmL: { chain: ["farmL", "handL"], parent: "uarmL", at: [0, -0.29, 0], dir: [0, -1, 0] },
  farmR: { chain: ["farmR", "handR"], parent: "uarmR", at: [0, -0.29, 0], dir: [0, -1, 0] },
  thighL: { chain: ["thighL", "shinL", "footL"], parent: "pelvis", at: [0.095, -0.05, 0], dir: [0, -1, 0] },
  thighR: { chain: ["thighR", "shinR", "footR"], parent: "pelvis", at: [-0.095, -0.05, 0], dir: [0, -1, 0] },
  shinL: { chain: ["shinL", "footL"], parent: "thighL", at: [0, -0.43, 0], dir: [0, -1, 0] },
  shinR: { chain: ["shinR", "footR"], parent: "thighR", at: [0, -0.43, 0], dir: [0, -1, 0] },
};

/** A severed piece flying free: original world matrices plus a rigid body. */
export class Gib {
  pieces: { mesh: GMesh; M0: Mat4 }[];
  c: V; pos: V; vel: V; ang: V; spin: V; rest = false; age = 0;
  private inv: Mat4;
  constructor(pieces: { mesh: GMesh; M0: Mat4 }[], c: V, vel: V) {
    this.pieces = pieces; this.c = c; this.pos = [...c]; this.vel = vel;
    this.ang = [0, 0, 0]; this.spin = [(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14];
    this.inv = trs(m4(), -c[0], -c[1], -c[2]);
  }
  step(dt: number, ground: (x: number, z: number) => number) {
    this.age += dt;
    if (this.rest) return;
    this.vel[1] -= 9.8 * dt;
    for (let i = 0; i < 3; i++) { this.pos[i] += this.vel[i] * dt; this.ang[i] += this.spin[i] * dt; }
    const g = ground(this.pos[0], this.pos[2]) + 0.07;
    if (this.pos[1] < g) {
      this.pos[1] = g;
      this.vel = [this.vel[0] * 0.45, Math.abs(this.vel[1]) * 0.28, this.vel[2] * 0.45];
      this.spin = this.spin.map((s) => s * 0.5) as V;
      if (Math.hypot(...this.vel) < 0.5) { this.rest = true; this.spin = [0, 0, 0]; }
    }
  }
  get moving() { return !this.rest; }
  draw(items: { mesh: GMesh; model: Mat4 }[]) {
    const G = mul(m4(), trs(m4(), this.pos[0], this.pos[1], this.pos[2], this.ang[1], this.ang[0], this.ang[2]), this.inv);
    for (const p of this.pieces) items.push({ mesh: p.mesh, model: mul(m4(), G, p.M0) });
  }
}
export const _inv = invert;
