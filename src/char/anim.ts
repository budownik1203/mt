// Poses and animation for the base human: idle / walk / T-pose / combat loop,
// two-bone IK so the off hand grips two-handed weapons, and shield placement.
import { Mat4, m4, mul, trs, invert, xform, lerp } from "../core/math.ts";
import { Pose, V3, Joint, RIG, solve } from "./human.ts";
import { GRIP, WeaponId, WEAPONS } from "./weapons.ts";

export type Anim = "idle" | "walk" | "t" | "combat";
export interface Equip { weapon: WeaponId | null; shield: "none" | "arm" | "back" }

type K = { tY: number; tP: number; rS: V3; rE: number; rW: V3; lS: V3; lE: number; sf: number; legs?: number };
const P = (tY: number, tP: number, rS: V3, rE: number, rW: V3, lS: V3 = [-0.75, 0.25, 0.12], lE = -1.15, sf = 1): K => ({ tY, tP, rS, rE, rW, lS, lE, sf });

// One-handed keyposes (sword / mace / hatchet). Weapon points along the fist's +Z.
const GUARD = P(0.1, 0.06, [-0.4, -0.1, -0.2], -1.25, [0.4, 0, 0]);
const OVER_W = P(-0.25, -0.08, [-2.75, -0.15, -0.25], -1.05, [-0.25, 0, 0]);
const OVER_S = P(0.2, 0.3, [-1.2, 0.1, 0], -0.15, [1.05, 0, 0]);
const RIGHT_W = P(-0.8, 0.05, [-1.35, -1.25, 0], -0.55, [1.45, 0, 0.3]);
const RIGHT_S = P(0.75, 0.12, [-1.45, 1.1, 0], -0.1, [1.5, 0, 0.2]);
const LEFT_W = P(0.65, 0.05, [-1.3, 1.0, 0.25], -0.95, [1.55, 0, -0.3]);
const LEFT_S = P(-0.7, 0.12, [-1.45, -1.15, 0], -0.1, [1.5, 0, -0.2]);
const THR_W = P(-0.45, 0, [-0.45, -0.3, -0.35], -1.8, [2.2, 0, 0]);
const THR_S = P(0.3, 0.18, [-1.55, 0.1, 0], 0, [1.5, 0, 0]);
const BLK_O = P(0, -0.05, [-2.35, 0.1, -0.1], -0.45, [0, 1.57, 0], [-1.65, 0.35, 0.3], -1.35, 1.25);
const BLK_R = P(-0.3, 0, [-0.85, -0.65, -0.35], -1.15, [0, 0, 0], [-0.9, 0.35, 0.1], -1.2, 1.1);

// Spear (two-handed) keyposes: right hand at the hip, left hand forward on the shaft.
const SP_GUARD = P(0.25, 0.08, [0.2, -0.15, -0.25], -1.5, [1.3, 0, 0.05]);
const SP_PULL = P(0.4, 0.0, [0.45, -0.15, -0.3], -1.75, [1.3, 0, 0.05]);
const SP_THRUST = P(-0.1, 0.22, [-0.65, 0.05, -0.1], -0.45, [1.1, 0, 0]);
const SP_LOW = P(0.1, 0.32, [-0.35, -0.05, -0.15], -0.8, [0.85, 0, 0]);

type Track = [number, K, number?][];   // [time, pose, ease power]
// Spear grips in torso space: rear fist position and shaft direction; the front hand sits 0.45 m up the shaft.
type SG = { rear: V3; dir: V3 };
const SG_GUARD: SG = { rear: [-0.2, -0.02, 0.04], dir: [0.38, 0.14, 1] };
const SG_PULL: SG = { rear: [-0.22, 0.02, -0.12], dir: [0.4, 0.1, 1] };
const SG_THRUST: SG = { rear: [-0.12, 0.1, 0.2], dir: [0.3, 0.04, 1] };
const SG_LOW: SG = { rear: [-0.16, 0.0, 0.08], dir: [0.42, -0.22, 1] };
const SPEAR_G: [number, SG, number?][] = [[0, SG_GUARD], [0.8, SG_GUARD], [1.2, SG_PULL], [1.38, SG_THRUST, 2], [1.9, SG_GUARD], [2.6, SG_GUARD], [2.95, SG_PULL], [3.12, SG_LOW, 2], [3.7, SG_GUARD], [4.2, SG_GUARD]];
function sampleG(t: number): SG {
  const tr = SPEAR_G, len = tr[tr.length - 1][0];
  t = ((t % len) + len) % len;
  let i = 0;
  while (i < tr.length - 2 && t >= tr[i + 1][0]) i++;
  const [ta, a] = tr[i], [tb, b, e = 1] = tr[i + 1];
  let k = tb > ta ? (t - ta) / (tb - ta) : 1;
  k = e === 1 ? k * k * (3 - 2 * k) : Math.pow(k, 1 / e);
  const l3 = (x: V3, y: V3): V3 => [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)];
  return { rear: l3(a.rear, b.rear), dir: l3(a.dir, b.dir) };
}
const ONE: Track = [[0, GUARD], [0.6, GUARD], [0.98, OVER_W], [1.18, OVER_S, 2], [1.6, GUARD], [2.0, GUARD], [2.38, RIGHT_W], [2.58, RIGHT_S, 2], [3.0, GUARD],
  [3.4, GUARD], [3.78, LEFT_W], [3.98, LEFT_S, 2], [4.4, GUARD], [4.8, GUARD], [5.18, THR_W], [5.36, THR_S, 2], [5.8, GUARD], [6.0, BLK_O], [6.6, BLK_O], [6.75, BLK_R], [7.3, BLK_R], [7.7, GUARD]];
const SPEAR: Track = [[0, SP_GUARD], [0.8, SP_GUARD], [1.2, SP_PULL], [1.38, SP_THRUST, 2], [1.9, SP_GUARD], [2.6, SP_GUARD], [2.95, SP_PULL], [3.12, SP_LOW, 2], [3.7, SP_GUARD], [4.2, SP_GUARD]];

function sample(tr: Track, t: number): K {
  const len = tr[tr.length - 1][0];
  t = ((t % len) + len) % len;
  let i = 0;
  while (i < tr.length - 2 && t >= tr[i + 1][0]) i++;
  const [ta, a] = tr[i], [tb, b, e = 1] = tr[i + 1];
  let k = tb > ta ? (t - ta) / (tb - ta) : 1;
  k = e === 1 ? k * k * (3 - 2 * k) : Math.pow(k, 1 / e) ;   // strikes snap through
  const l3 = (x: V3, y: V3): V3 => [lerp(x[0], y[0], k), lerp(x[1], y[1], k), lerp(x[2], y[2], k)];
  return { tY: lerp(a.tY, b.tY, k), tP: lerp(a.tP, b.tP, k), rS: l3(a.rS, b.rS), rE: lerp(a.rE, b.rE, k), rW: l3(a.rW, b.rW), lS: l3(a.lS, b.lS), lE: lerp(a.lE, b.lE, k), sf: lerp(a.sf, b.sf, k) };
}

function combatPose(k: K): Pose {
  return {
    r: {
      pelvis: [0, k.tY * 0.3, 0], torso: [k.tP, k.tY * 0.7, 0], head: [-k.tP * 0.6, -k.tY * 0.55, 0],
      uarmR: k.rS, farmR: [k.rE, 0, 0], handR: k.rW,
      uarmL: k.lS, farmL: [k.lE, 0, 0], handL: [0, 0, 0],
      thighL: [-0.25, -0.1, 0.06], shinL: [0.22, 0, 0], footL: [0.03, 0.1, 0],
      thighR: [0.12, 0.15, -0.08], shinR: [0.2, 0, 0], footR: [-0.32, 0, 0],
    },
    bob: -0.02,
  };
}

/** Base pose for the given animation and equipment. Returns the pose and how far the shield faces forward (0 side .. 1 front). */
export function animate(kind: Anim, t: number, eq: Equip): { pose: Pose; sf: number; ikL: boolean } {
  const spear = eq.weapon === "spear";
  if (kind === "combat") {
    const k = sample(spear ? SPEAR : ONE, t);
    const pose = combatPose(k);
    if (eq.shield !== "arm" && !spear) { pose.r.uarmL = [-0.35, 0.2, 0.25]; pose.r.farmL = [-1.0, 0, 0]; pose.r.handL = [0, 0, 0]; }
    return { pose, sf: eq.shield === "arm" ? k.sf : 0, ikL: spear };
  }
  if (kind === "t") return { pose: { r: { uarmL: [0, 0, Math.PI / 2], uarmR: [0, 0, -Math.PI / 2], handR: [0.9, 0, 0] } }, sf: 0, ikL: false };
  // weapon held at rest: blade/head down-forward; spear upright beside the body
  const restHand: V3 = spear ? [-1.42, 0, 0] : [1.05, 0, -0.05];
  if (kind === "walk") {
    const s = Math.sin(t * 5.2), c = Math.cos(t * 5.2);
    const leg = (ph: number) => {
      const sw = Math.sin(t * 5.2 + ph);
      const knee = Math.max(0, Math.cos(t * 5.2 + ph)) * 0.75 + 0.06;
      return { thigh: [-sw * 0.45, 0, 0] as V3, shin: [knee, 0, 0] as V3, foot: [-sw * 0.15 - 0.05, 0, 0] as V3 };
    };
    const l = leg(0), r = leg(Math.PI);
    const armR: V3 = spear ? [-0.12, 0, -0.08] : [-s * 0.3, 0, -0.12];
    return {
      pose: {
        r: {
          pelvis: [0, s * 0.06, 0], torso: [0.05, -s * 0.09, 0], head: [-0.03, s * 0.05, 0],
          uarmL: eq.shield === "arm" ? [s * 0.15 - 0.1, 0, 0.2] : [s * 0.42, 0, 0.1], farmL: [-0.3 - Math.max(0, s) * 0.3, 0, 0],
          uarmR: armR, farmR: [spear ? -0.55 : -0.35 - Math.max(0, -s) * 0.25, 0, 0], handR: restHand,
          thighL: l.thigh, shinL: l.shin, footL: l.foot, thighR: r.thigh, shinR: r.shin, footR: r.foot,
        },
        bob: Math.abs(c) * 0.035,
      }, sf: 0, ikL: false,
    };
  }
  const br = Math.sin(t * 1.6) * 0.015;
  return {
    pose: {
      r: {
        torso: [br, 0, 0], head: [-br, 0, 0],
        uarmL: eq.shield === "arm" ? [-0.05, 0, 0.22] : [0.04, 0, 0.13], farmL: [-0.18, 0, 0], handL: [0, 0, 0.05],
        uarmR: spear ? [-0.12, 0, -0.1] : [0.02, 0, -0.14], farmR: [spear ? -0.55 : -0.25, 0, 0], handR: restHand,
        thighL: [0, 0, 0.02], thighR: [0, 0, -0.02], shinL: [0.03, 0, 0], shinR: [0.03, 0, 0],
      },
    }, sf: 0, ikL: false,
  };
}

// ---------- IK ----------
type Vec = [number, number, number];
const sub3 = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a: Vec): Vec => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const sc = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
const add3 = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const basis = (x: Vec, y: Vec, z: Vec): Mat4 => { const m = m4(); m.set([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]); return m; };
const rotOnly = (m: Mat4): Mat4 => { const r = new Float32Array(m) as Mat4; r[12] = r[13] = r[14] = 0; return r; };
const tdir = (m: Mat4, v: Vec): Vec => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];

/** Two-bone IK: puts the fist of one arm on `target` (root space), grip along `axis`. */
function ikArm(side: "L" | "R", pose: Pose, J: Record<Joint, Mat4>, target: Vec, axis: Vec) {
  const inv = invert(m4(), J.torso);
  const T = xform(inv, ...target) as Vec;
  const S = RIG[`uarm${side}`].at as Vec;
  const U = 0.29, F = 0.26 + 0.07;
  let d = sub3(T, S);
  const L = Math.min(Math.max(Math.hypot(...d), 0.1), U + F - 0.004);
  const dn = nrm(d);
  const pole = nrm([side === "L" ? 0.55 : -0.55, -0.9, -0.35]);
  const cosA = (U * U + L * L - F * F) / (2 * U * L), A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const q = nrm(sub3(pole, sc(dn, dot(pole, dn))));
  const a = add3(sc(dn, Math.cos(A)), sc(q, Math.sin(A)));
  const E = add3(S, sc(a, U));
  const Tp = add3(S, sc(dn, L));
  const f = nrm(sub3(Tp, E));
  const Y = sc(a, -1) as Vec, X = nrm(cross(a, q)), Z = cross(X, Y);
  const R = basis(X, Y, Z);
  // forearm bend about the upper arm's X
  const fl: Vec = [dot(X, f), dot(Y, f), dot(Z, f)];
  const e = Math.atan2(-fl[2], -fl[1]);
  pose.m = { ...(pose.m ?? {}), [`uarm${side}`]: R };
  pose.r[`farm${side}`] = [e, 0, 0];
  // hand: keep the fist in line with the forearm, turn it so the grip follows the shaft
  const J2 = solve(m4(), pose);
  const wl = nrm(tdir(invert(m4(), rotOnly(J2[`farm${side}`])), axis));
  const Yh: Vec = [0, 1, 0];
  let Zh = nrm(sub3(wl, sc(Yh, dot(wl, Yh))));
  if (!isFinite(Zh[0])) Zh = [0, 0, 1];
  const Xh = cross(Yh, Zh);
  pose.m[`hand${side}`] = basis(Xh, Yh, Zh);
  void d; d = [0, 0, 0];
}

export interface Frame { J: Record<Joint, Mat4>; weapon: Mat4 | null; shield: Mat4 | null }

/** Solve the full frame: joints, IK for two-handed grips, weapon and shield matrices. */
export function frame(root: Mat4, kind: Anim, t: number, eq: Equip): Frame {
  const { pose, sf, ikL } = animate(kind, t, eq);
  let J = solve(root, pose);
  let weapon = eq.weapon ? mul(m4(), J.handR, GRIP()) : null;
  if (weapon && ikL && eq.weapon) {
    const g = sampleG(t), spec = WEAPONS[eq.weapon];
    const J0 = solve(m4(), pose);
    const dirT = nrm(g.dir as Vec);
    const rear = xform(J0.torso, ...g.rear) as Vec;
    const ax = nrm(tdir(J0.torso, dirT));
    const front = add3(rear, sc(ax, spec.twoHand));
    ikArm("R", pose, J0, rear, ax);
    ikArm("L", pose, solve(m4(), pose), front, ax);
    J = solve(root, pose);
    // weapon frame: origin at the rear fist, +Z along the shaft, edges vertical
    const up: Vec = [0, 1, 0];
    const X = nrm(cross(up, ax)), Y = cross(ax, X);
    const wl = basis(X, Y, ax); wl[12] = rear[0]; wl[13] = rear[1]; wl[14] = rear[2];
    weapon = mul(m4(), root, wl);
  }
  let shield: Mat4 | null = null;
  if (eq.shield === "back") shield = mul(m4(), J.torso, trs(m4(), 0, 0.2, -0.205, Math.PI, 0.08, 0));
  if (eq.shield === "arm") {
    // straps on the left forearm; the face turns from the side (rest) to the front (guard)
    const p = xform(J.farmL, 0, -0.14, 0);
    const tor = J.torso;
    const fwd = nrm(tdir(tor, [0, 0, 1])), side = nrm(tdir(tor, [1, 0, 0]));
    const s = Math.max(0, Math.min(1.3, sf));
    const out = add3(sc(side, lerp(0.075, 0.02, Math.min(1, s))), sc(fwd, lerp(0.0, 0.1, Math.min(1, s))));
    const yawT = Math.atan2(fwd[0], fwd[2]);
    shield = trs(m4(), p[0] + out[0], p[1] + out[1] + (s > 1 ? (s - 1) * 0.35 : 0), p[2] + out[2], yawT + lerp(Math.PI / 2 - 0.15, 0.28, Math.min(1, s)), lerp(0.05, -0.12, Math.min(1, s)) - (s > 1 ? (s - 1) * 1.5 : 0), 0);
  }
  return { J, weapon, shield };
}
