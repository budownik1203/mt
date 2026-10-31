// Mount & Blade-style melee animation.
//
// Every weapon class (one-handed, two-handed, polearm) has ONE set of moves:
// overhead, right swing, left swing, thrust (mouse down), four directional
// blocks, plus a shield block. The weapon model is swapped, the motion is not.
//
// Moves are authored on the weapon itself: where the right fist is (torso
// space), where the weapon points, and which way its cutting edge faces.
// Two-bone IK then puts the hands on the grip, so arcs stay clean and both
// fists stay on two-handed grips and polearm shafts.
import { Mat4, m4, mul, trs, invert, xform, lerp } from "../core/math.ts";
import { Pose, V3, Joint, RIG, solve } from "./human.ts";
import { GRIP, WeaponId, WEAPONS, WClass } from "./weapons.ts";

export type Anim = "idle" | "walk" | "t" | "combat";
export type Move = "all" | "over" | "right" | "left" | "thrust" | "blocks";
export interface Equip { weapon: WeaponId | null; shield: "none" | "arm" | "back"; move?: Move }

type Vec = [number, number, number];
/** A weapon key: right-fist position (torso space), weapon direction, cutting-edge direction, torso yaw & pitch. */
interface WK { g: Vec; d: Vec; e: Vec; ty: number; tp: number }
const K = (g: Vec, d: Vec, e: Vec, ty = 0, tp = 0): WK => ({ g, d, e, ty, tp });

/** An attack: ready (held while the button is down), arc keys up to impact, follow-through. */
interface Attack { ready: WK; arc: WK[]; impact: WK; end: WK }
interface ClassAnims { guard: WK; idle: WK; attacks: Record<"over" | "right" | "left" | "thrust", Attack>; blocks: Record<"up" | "right" | "left" | "down", WK> }

// Torso space: +X is the fighter's left, +Z forward, +Y up; origin at the waist (~1.05 m).
// Right shoulder sits at (-0.17, 0.35, 0).
const OH: ClassAnims = {
  guard: K([-0.2, 0.14, 0.3], [0.08, 0.72, 0.68], [0, -0.68, 0.72], 0.1, 0.05),
  idle: K([-0.22, -0.2, 0.14], [0.05, -0.5, 0.86], [0, 0.86, 0.5], 0, 0),
  attacks: {
    over: {
      ready: K([-0.21, 0.6, -0.04], [0.05, 0.35, -0.94], [0, 0.94, 0.35], -0.2, -0.12),
      arc: [K([-0.1, 0.66, 0.16], [0.02, 0.98, 0.18], [0, -0.18, 0.98], -0.05, 0.05)],
      impact: K([-0.06, 0.3, 0.46], [0, 0.1, 1], [0, -1, 0.1], 0.08, 0.28),
      end: K([-0.02, 0.02, 0.36], [0.08, -0.62, 0.78], [0, -0.78, -0.62], 0.14, 0.36),
    },
    right: {
      ready: K([-0.42, 0.4, -0.06], [-0.28, 0.4, -0.87], [-0.95, 0, 0.3], -0.75, 0.0),
      arc: [K([-0.36, 0.32, 0.2], [-0.96, 0.18, 0.18], [0.2, 0, 1], -0.35, 0.05)],
      impact: K([-0.1, 0.26, 0.48], [0.25, 0.05, 0.97], [0.97, 0, -0.25], 0.2, 0.1),
      end: K([0.22, 0.18, 0.3], [0.98, -0.05, 0.12], [0.12, 0, -0.98], 0.75, 0.12),
    },
    left: {
      ready: K([0.14, 0.38, 0.22], [0.55, 0.42, -0.72], [0.8, 0, 0.6], 0.6, 0.0),
      arc: [K([0.1, 0.3, 0.26], [0.97, 0.15, 0.15], [-0.15, 0, 0.99], 0.35, 0.05)],
      impact: K([-0.06, 0.24, 0.48], [-0.25, 0.05, 0.97], [-0.97, 0, -0.25], -0.15, 0.1),
      end: K([-0.36, 0.14, 0.26], [-0.98, -0.08, 0.12], [-0.12, 0, -0.99], -0.7, 0.12),
    },
    thrust: {
      ready: K([-0.24, 0.08, -0.14], [0.06, 0.12, 0.99], [0, 1, -0.12], -0.5, 0.0),
      arc: [],
      impact: K([-0.08, 0.22, 0.56], [0.04, 0.02, 1], [0, 1, 0], 0.28, 0.16),
      end: K([-0.07, 0.2, 0.58], [0.04, 0.0, 1], [0, 1, 0], 0.3, 0.18),
    },
  },
  blocks: {
    up: K([-0.16, 0.62, 0.26], [0.99, 0.08, 0.1], [0, 1, 0], 0, -0.05),
    right: K([-0.36, 0.24, 0.32], [-0.05, 0.99, 0.12], [-1, 0, 0], -0.25, 0),
    left: K([0.12, 0.24, 0.34], [0.05, 0.99, 0.12], [1, 0, 0], 0.3, 0),
    down: K([-0.06, 0.18, 0.4], [0.05, -0.97, 0.22], [1, 0, 0], 0.05, 0.08),
  },
};

const TH: ClassAnims = {
  guard: K([-0.08, 0.12, 0.34], [0.05, 0.6, 0.8], [0, -0.8, 0.6], 0.1, 0.05),
  idle: K([-0.1, -0.08, 0.28], [0.08, 0.72, 0.68], [0, -0.68, 0.72], 0.05, 0),
  attacks: {
    over: {
      ready: K([-0.05, 0.6, 0.02], [0.04, 0.45, -0.89], [0, 0.89, 0.45], -0.15, -0.14),
      arc: [K([-0.04, 0.62, 0.22], [0.02, 0.97, 0.22], [0, -0.22, 0.97], -0.05, 0.05)],
      impact: K([-0.02, 0.24, 0.48], [0, 0.08, 1], [0, -1, 0.08], 0.05, 0.3),
      end: K([0, -0.06, 0.38], [0.05, -0.7, 0.7], [0, -0.7, -0.7], 0.08, 0.4),
    },
    right: {
      ready: K([-0.3, 0.42, 0.06], [-0.38, 0.45, -0.81], [-0.9, 0, 0.42], -0.7, 0),
      arc: [K([-0.3, 0.3, 0.26], [-0.95, 0.2, 0.22], [0.22, 0, 0.97], -0.35, 0.05)],
      impact: K([-0.02, 0.22, 0.48], [0.2, 0.02, 0.98], [0.98, 0, -0.2], 0.15, 0.12),
      end: K([0.26, 0.08, 0.3], [0.98, -0.12, 0.1], [0.1, 0, -0.99], 0.7, 0.14),
    },
    left: {
      ready: K([0.16, 0.42, 0.22], [0.4, 0.45, -0.8], [0.9, 0, 0.45], 0.6, 0),
      arc: [K([0.14, 0.3, 0.26], [0.96, 0.2, 0.2], [-0.2, 0, 0.98], 0.3, 0.05)],
      impact: K([-0.04, 0.22, 0.48], [-0.2, 0.02, 0.98], [-0.98, 0, -0.2], -0.15, 0.12),
      end: K([-0.32, 0.08, 0.3], [-0.98, -0.12, 0.1], [-0.1, 0, -0.99], -0.65, 0.14),
    },
    thrust: {
      ready: K([-0.14, 0.04, -0.04], [0.04, 0.12, 0.99], [0, 1, -0.12], -0.4, 0),
      arc: [],
      impact: K([-0.04, 0.2, 0.5], [0.02, 0.03, 1], [0, 1, 0], 0.22, 0.14),
      end: K([-0.04, 0.19, 0.52], [0.02, 0.0, 1], [0, 1, 0], 0.24, 0.16),
    },
  },
  blocks: {
    up: K([-0.02, 0.6, 0.26], [-0.99, 0.1, 0.05], [0, 1, 0], 0, -0.05),
    right: K([-0.3, 0.16, 0.32], [-0.05, 0.99, 0.1], [-1, 0, 0], -0.2, 0),
    left: K([0.2, 0.16, 0.32], [0.05, 0.99, 0.1], [1, 0, 0], 0.25, 0),
    down: K([-0.04, 0.42, 0.36], [0.05, -0.97, 0.2], [1, 0, 0], 0, 0.06),
  },
};

// Polearm: right fist at the rear, left fist 0.45 m up the shaft.
const PA: ClassAnims = {
  guard: K([-0.2, -0.02, 0.04], [0.38, 0.14, 0.91], [0, 1, -0.15], 0.15, 0.06),
  idle: K([-0.22, -0.2, 0.1], [0.02, 1, 0.08], [1, 0, 0], 0, 0),
  attacks: {
    over: {   // two-handed overhead swing, as in Warband
      ready: K([-0.18, 0.42, -0.04], [0.15, 0.75, -0.65], [0, 0.65, 0.75], -0.25, -0.1),
      arc: [K([-0.15, 0.44, 0.12], [0.1, 0.95, 0.25], [0, -0.25, 0.97], -0.1, 0.02)],
      impact: K([-0.1, 0.3, 0.24], [0.25, 0.05, 0.97], [0, -1, 0.05], 0.1, 0.18),
      end: K([-0.08, 0.16, 0.22], [0.25, -0.45, 0.86], [0, -0.86, -0.45], 0.15, 0.26),
    },
    right: {
      ready: K([0.12, 0.16, 0.04], [-0.85, 0.25, 0.46], [-0.46, 0, -0.85], -0.4, 0.02),
      arc: [K([0.04, 0.16, 0.14], [-0.5, 0.15, 0.85], [0.85, 0, -0.5], -0.15, 0.05)],
      impact: K([-0.04, 0.15, 0.2], [0.05, 0.05, 1], [1, 0, -0.05], 0.15, 0.08),
      end: K([-0.2, 0.12, 0.1], [0.85, 0, 0.5], [0.5, 0, -0.85], 0.5, 0.1),
    },
    left: {
      ready: K([-0.26, 0.16, 0.04], [0.82, 0.25, 0.5], [0.5, 0, -0.82], 0.45, 0.02),
      arc: [K([-0.22, 0.16, 0.1], [0.5, 0.15, 0.85], [-0.85, 0, 0.5], 0.2, 0.05)],
      impact: K([-0.12, 0.15, 0.18], [-0.05, 0.05, 1], [-1, 0, -0.05], -0.1, 0.08),
      end: K([0.04, 0.12, 0.1], [-0.85, 0, 0.5], [-0.5, 0, -0.85], -0.45, 0.1),
    },
    thrust: {
      ready: K([-0.22, 0.02, -0.12], [0.4, 0.1, 0.91], [0, 1, -0.1], 0.3, 0),
      arc: [],
      impact: K([-0.12, 0.1, 0.2], [0.3, 0.04, 0.95], [0, 1, -0.04], -0.1, 0.18),
      end: K([-0.11, 0.1, 0.22], [0.3, 0.02, 0.95], [0, 1, 0], -0.12, 0.2),
    },
  },
  blocks: {
    up: K([-0.3, 0.58, 0.18], [1, 0.02, 0.04], [0, 1, 0], 0, -0.04),
    right: K([-0.3, -0.02, 0.3], [0.04, 0.99, 0.08], [-1, 0, 0], -0.15, 0),
    left: K([0.04, -0.02, 0.3], [0.06, 0.99, 0.08], [1, 0, 0], 0.2, 0),
    down: K([-0.14, 0.34, 0.24], [0.16, -0.98, 0.1], [1, 0, 0], 0, 0.06),
  },
};
const CLASSES: Record<WClass, ClassAnims> = { oh: OH, th: TH, pa: PA };

/** Warband-like timings (seconds). */
const T = { toReady: 0.38, hold: 0.32, toImpact: 0.13, follow: 0.12, recover: 0.4, gap: 0.25, block: 0.55 };

type Seg = { t: number; k: WK; ease: "smooth" | "snap"; block?: boolean };
function timeline(cls: WClass, canThrust: boolean, move: Move): Seg[] {
  const A = CLASSES[cls];
  const out: Seg[] = [{ t: 0, k: A.guard, ease: "smooth" }];
  let t = T.gap;
  const push = (dt: number, k: WK, ease: Seg["ease"] = "smooth", block = false) => { t += dt; out.push({ t, k, ease, block }); };
  const dirs: ("over" | "right" | "left" | "thrust")[] = move === "all" ? ["over", "right", "left", "thrust"] : move === "blocks" ? [] : [move];
  for (const d0 of dirs) {
    const d = d0 === "thrust" && !canThrust ? "over" : d0;   // axes and maces: thrust becomes an overhead
    const a = A.attacks[d];
    out.push({ t, k: A.guard, ease: "smooth" });
    push(T.toReady, a.ready);
    push(T.hold, a.ready);
    const n = a.arc.length + 1;
    for (const k of a.arc) push(T.toImpact * 0.55 / n * 2, k, "snap");
    push(T.toImpact * (a.arc.length ? 0.45 : 1), a.impact, "snap");
    push(T.follow, a.end, "smooth");
    push(T.recover, A.guard);
    t += T.gap;
  }
  if (move === "all" || move === "blocks") {
    for (const b of ["up", "right", "left", "down"] as const) {
      out.push({ t, k: A.guard, ease: "smooth" });
      push(0.16, A.blocks[b], "snap", true);
      push(T.block, A.blocks[b], "smooth", true);
      push(0.22, A.guard);
      t += 0.12;
    }
  }
  out.push({ t: t + 0.3, k: A.guard, ease: "smooth" });
  return out;
}

const nlerp = (a: Vec, b: Vec, k: number): Vec => nrm([lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]);
function sampleTL(tl: Seg[], t: number): { k: WK; block: boolean } {
  const len = tl[tl.length - 1].t;
  t = ((t % len) + len) % len;
  let i = 0;
  while (i < tl.length - 2 && t >= tl[i + 1].t) i++;
  const a = tl[i], b = tl[i + 1];
  let k = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
  k = b.ease === "snap" ? 1 - (1 - k) * (1 - k) : k * k * (3 - 2 * k);
  const g: Vec = [lerp(a.k.g[0], b.k.g[0], k), lerp(a.k.g[1], b.k.g[1], k), lerp(a.k.g[2], b.k.g[2], k)];
  return { k: { g, d: nlerp(a.k.d, b.k.d, k), e: nlerp(a.k.e, b.k.e, k), ty: lerp(a.k.ty, b.k.ty, k), tp: lerp(a.k.tp, b.k.tp, k) }, block: !!(a.block || b.block) && k > 0.3 };
}
export function loopLength(w: WeaponId, move: Move) { const s = WEAPONS[w]; const tl = timeline(s.cls, s.thrust, move); return tl[tl.length - 1].t; }

// ---------- vector helpers ----------
const sub3 = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function nrm(a: Vec): Vec { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
const sc = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const add3 = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const basis = (x: Vec, y: Vec, z: Vec): Mat4 => { const m = m4(); m.set([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]); return m; };
const rotOnly = (m: Mat4): Mat4 => { const r = new Float32Array(m) as Mat4; r[12] = r[13] = r[14] = 0; return r; };
const tdir = (m: Mat4, v: Vec): Vec => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];

/** Two-bone IK: puts one fist on `target` (root space), grip along `axis`. */
function ikArm(side: "L" | "R", pose: Pose, J: Record<Joint, Mat4>, target: Vec, axis: Vec) {
  const inv = invert(m4(), J.torso);
  const Tt = xform(inv, ...target) as Vec;
  const S = RIG[`uarm${side}`].at as Vec;
  const U = 0.29, F = 0.26 + 0.07;
  const d = sub3(Tt, S);
  const L = Math.min(Math.max(Math.hypot(...d), 0.1), U + F - 0.004);
  const dn = nrm(d);
  const pole = nrm([side === "L" ? 0.55 : -0.55, -0.9, -0.35]);
  const cosA = (U * U + L * L - F * F) / (2 * U * L), A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  let q = sub3(pole, sc(dn, dot(pole, dn)));
  if (Math.hypot(...q) < 1e-4) q = [0, -1, 0];
  q = nrm(q);
  const a = add3(sc(dn, Math.cos(A)), sc(q, Math.sin(A)));
  const E = add3(S, sc(a, U));
  const f = nrm(sub3(add3(S, sc(dn, L)), E));
  const Y = sc(a, -1) as Vec, X = nrm(cross(a, q)), Z = cross(X, Y);
  const fl: Vec = [dot(X, f), dot(Y, f), dot(Z, f)];
  pose.m = { ...(pose.m ?? {}), [`uarm${side}`]: basis(X, Y, Z) };
  pose.r[`farm${side}`] = [Math.atan2(-fl[2], -fl[1]), 0, 0];
  const J2 = solve(m4(), pose);
  const wl = nrm(tdir(invert(m4(), rotOnly(J2[`farm${side}`])), axis));
  const Yh: Vec = [0, 1, 0];
  let Zh = sub3(wl, sc(Yh, dot(wl, Yh)));
  Zh = Math.hypot(...Zh) < 1e-4 ? [0, 0, 1] : nrm(Zh);
  pose.m[`hand${side}`] = basis(cross(Yh, Zh), Yh, Zh);
}

const STANCE = {
  thighL: [-0.25, -0.1, 0.06] as V3, shinL: [0.22, 0, 0] as V3, footL: [0.03, 0.1, 0] as V3,
  thighR: [0.12, 0.15, -0.08] as V3, shinR: [0.2, 0, 0] as V3, footR: [-0.32, 0, 0] as V3,
};

export interface Frame { J: Record<Joint, Mat4>; weapon: Mat4 | null; shield: Mat4 | null; blocking: boolean }

/** Weapon frame from a key: +Z along the weapon, cutting edge (-Y) toward the motion. */
function weaponMat(k: WK, torso: Mat4): Mat4 {
  const z = nrm(tdir(torso, k.d));
  let e = tdir(torso, k.e);
  e = sub3(e, sc(z, dot(e, z)));
  if (Math.hypot(...e) < 1e-4) e = [0, 1, 0];
  const y = sc(nrm(e), -1) as Vec;
  const x = cross(y, z);
  const m = basis(x, y, z);
  const p = xform(torso, ...k.g);
  m[12] = p[0]; m[13] = p[1]; m[14] = p[2];
  return m;
}

/** Solve a full frame: body, IK hands on the weapon, weapon and shield matrices. */
export function frame(root: Mat4, kind: Anim, t: number, eq: Equip): Frame {
  const spec = eq.weapon ? WEAPONS[eq.weapon] : null;
  const shieldArm = eq.shield === "arm";
  let key: WK | null = null, blocking = false, legs: Pose["r"] = {}, bob = 0;
  const pose: Pose = { r: {} };

  if (kind === "t") {
    pose.r = { uarmL: [0, 0, Math.PI / 2], uarmR: [0, 0, -Math.PI / 2], handR: [0.9, 0, 0] };
  } else if (kind === "walk") {
    const s = Math.sin(t * 5.2), c = Math.cos(t * 5.2);
    const leg = (ph: number) => {
      const sw = Math.sin(t * 5.2 + ph), knee = Math.max(0, Math.cos(t * 5.2 + ph)) * 0.75 + 0.06;
      return { thigh: [-sw * 0.45, 0, 0] as V3, shin: [knee, 0, 0] as V3, foot: [-sw * 0.15 - 0.05, 0, 0] as V3 };
    };
    const l = leg(0), r = leg(Math.PI);
    legs = { thighL: l.thigh, shinL: l.shin, footL: l.foot, thighR: r.thigh, shinR: r.shin, footR: r.foot };
    pose.r = { pelvis: [0, s * 0.06, 0], torso: [0.05, -s * 0.09, 0], head: [-0.03, s * 0.05, 0], uarmL: shieldArm ? [s * 0.15 - 0.1, 0, 0.2] : [s * 0.42, 0, 0.1], farmL: [-0.3 - Math.max(0, s) * 0.3, 0, 0] };
    bob = Math.abs(c) * 0.035;
    if (spec) key = { ...CLASSES[spec.cls].idle, g: add3(CLASSES[spec.cls].idle.g, [0, Math.abs(s) * 0.02, 0]) };
  } else if (kind === "idle") {
    const br = Math.sin(t * 1.6) * 0.015;
    pose.r = { torso: [br, 0, 0], head: [-br, 0, 0], uarmL: shieldArm ? [-0.05, 0, 0.22] : [0.04, 0, 0.13], farmL: [-0.18, 0, 0], handL: [0, 0, 0.05] };
    legs = { thighL: [0, 0, 0.02], thighR: [0, 0, -0.02], shinL: [0.03, 0, 0], shinR: [0.03, 0, 0] };
    if (spec) key = CLASSES[spec.cls].idle;
  } else if (spec) {
    const s = sampleTL(timeline(spec.cls, spec.thrust, eq.move ?? "all"), t);
    key = s.k; blocking = s.block;
    legs = STANCE; bob = -0.02;
    pose.r = {
      pelvis: [0, key.ty * 0.35, 0], torso: [key.tp, key.ty * 0.65, 0], head: [-key.tp * 0.6, -key.ty * 0.6, 0],
      uarmL: shieldArm ? (blocking ? [-1.25, 0.35, 0.2] : [-0.75, 0.25, 0.12]) : [-0.3, 0.2, 0.25],
      farmL: shieldArm ? [blocking ? -1.25 : -1.15, 0, 0] : [-0.95, 0, 0], handL: [0, 0, 0],
    };
  }
  pose.r = { ...pose.r, ...legs };
  pose.bob = bob;

  // shield-bearers block with the shield; the sword waits in guard
  if (kind === "combat" && shieldArm && blocking && spec) key = CLASSES[spec.cls].guard;

  let J = solve(root, pose);
  let weapon: Mat4 | null = null;
  if (spec && key) {
    const inv = invert(m4(), root);
    const J0 = solve(m4(), pose);
    const wl = weaponMat(key, J0.torso);
    const ax: Vec = [wl[8], wl[9], wl[10]];
    const rf: Vec = [wl[12], wl[13], wl[14]];
    // polearm at rest (idle/walk) rides in the right hand only, upright
    const oneHanded = spec.offhand === 0;
    ikArm("R", pose, J0, rf, ax);
    // weapon sits in the actual right fist (IK can fall a few mm short at full reach), then the left hand finds the grip
    const fp = xform(solve(m4(), pose).handR, 0, -0.07, 0.004);
    wl[12] = fp[0]; wl[13] = fp[1]; wl[14] = fp[2];
    if (!oneHanded) ikArm("L", pose, solve(m4(), pose), add3(fp as Vec, sc(ax, spec.offhand)), ax);
    J = solve(root, pose);
    weapon = mul(m4(), root, wl);
    void inv;
  } else if (spec) {
    weapon = mul(m4(), J.handR, GRIP());
  }

  let shield: Mat4 | null = null;
  if (eq.shield === "back") shield = mul(m4(), J.torso, trs(m4(), 0, 0.2, -0.205, Math.PI, 0.08, 0));
  if (shieldArm) {
    const sf = kind === "combat" ? (blocking ? 1.25 : 1) : 0;
    const p = xform(J.farmL, 0, -0.14, 0);
    const fwd = nrm(tdir(J.torso, [0, 0, 1])), side = nrm(tdir(J.torso, [1, 0, 0]));
    const s1 = Math.min(1, sf);
    const out = add3(sc(side, lerp(0.075, 0.02, s1)), sc(fwd, lerp(0, 0.1, s1)));
    const yawT = Math.atan2(fwd[0], fwd[2]);
    shield = trs(m4(), p[0] + out[0], p[1] + out[1] + (sf > 1 ? (sf - 1) * 0.3 : 0), p[2] + out[2], yawT + lerp(Math.PI / 2 - 0.15, 0.22, s1), lerp(0.05, -0.1, s1) - (sf > 1 ? (sf - 1) * 0.8 : 0), 0);
  }
  return { J, weapon, shield, blocking };
}
