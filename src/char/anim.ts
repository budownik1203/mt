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

export type Anim = "idle" | "walk" | "t" | "combat" | "walkcombat";
export type Move = "all" | "over" | "right" | "left" | "thrust" | "blocks" | "parried";
export interface Equip { weapon: WeaponId | null; shield: "none" | "arm" | "back"; move?: Move }

type Vec = [number, number, number];
// ---------- vector helpers ----------
function sub3(a: Vec, b: Vec): Vec { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
const _sub3 = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
function dot(a: Vec, b: Vec) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
const _dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function nrm(a: Vec): Vec { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function sc(a: Vec, k: number): Vec { return [a[0] * k, a[1] * k, a[2] * k]; }
const _sc = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
function add3(a: Vec, b: Vec): Vec { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
const _add3 = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const basis = (x: Vec, y: Vec, z: Vec): Mat4 => { const m = m4(); m.set([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]); return m; };
const rotOnly = (m: Mat4): Mat4 => { const r = new Float32Array(m) as Mat4; r[12] = r[13] = r[14] = 0; return r; };
const tdir = (m: Mat4, v: Vec): Vec => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];

void _sub3; void _dot; void _sc; void _add3;

/** A weapon key: right-fist position (torso space), weapon direction, cutting-edge direction, torso yaw & pitch. */
interface WK { g: Vec; d: Vec; e: Vec; ty: number; tp: number }
const K = (g: Vec, d: Vec, e: Vec, ty = 0, tp = 0): WK => ({ g, d, e, ty, tp });

/*
 * How Warband builds a melee attack (module_animations / actions.txt):
 *   ready_<dir>_<class>      wind-up into a held pose (~0.35 s), held while the button is down
 *   release_<dir>_<class>    the strike: accelerates through the hit window
 *   release_<dir>_continue   follow-through after a clean hit or a miss
 *   parried_<dir>_<class>    the release played BACKWARDS toward the ready pose when it meets a parry
 *   blocked_<dir>_<class>    same bounce, shorter, when it hits a shield or wall
 * Swings travel on a circle around the body with strong shoulder rotation (the wind-up
 * twists the torso away, the release unwinds it past centre); the wrist lags behind the
 * arm on the way in and whips through at impact. Thrusts are a straight line from a
 * pulled-back hip position. Parries hold the weapon across the incoming line; shields
 * tilt toward the side being attacked (defend_shield_forward/up/left/right).
 * Attacks are upper-body animations layered over whatever the legs are doing.
 */

type Dir = "over" | "right" | "left" | "thrust";
interface Arc { keys: WK[]; impact: number /* index of the impact key */ }
interface ClassAnims {
  guard: WK; idle: WK;
  arcs: Record<Dir, Arc>;
  blocks: Record<"up" | "right" | "left" | "down", WK>;
}

const D2R = Math.PI / 180;
/**
 * Horizontal swing on a circle around the chest. a: angle in the torso's XZ plane
 * (0 = straight ahead, negative = fighter's right). lag: how far the blade trails
 * the arm (wrist cock). side: +1 right-to-left swing, -1 left-to-right.
 */
function hSwing(c: Vec, r: number, a: number, y: number, lag: number, lift: number, side: 1 | -1, twist: number, pitch: number): WK {
  const ar = a * D2R, br = (a - lag * side) * D2R;
  const g: Vec = [c[0] + Math.sin(ar) * r, y, c[2] + Math.cos(ar) * r];
  const d = nrm([Math.sin(br), lift, Math.cos(br)]);
  const tan: Vec = sc([Math.cos(br), 0, -Math.sin(br)], side);   // direction of travel
  const e = nrm(sub3(tan, sc(d, dot(tan, d))));
  return { g, d, e, ty: twist, tp: pitch };
}
/** Vertical (overhead) swing in a plane slightly right of centre. b: 0 = straight up, 90 = straight ahead. */
function vSwing(c: Vec, r: number, b: number, lag: number, x: number, twist: number, pitch: number): WK {
  const br = b * D2R, dr = (b - lag) * D2R;
  const g: Vec = [c[0] + x, c[1] + Math.cos(br) * r, c[2] + Math.sin(br) * r];
  const d = nrm([0.04, Math.cos(dr), Math.sin(dr)]);
  const tan: Vec = [0, -Math.sin(dr), Math.cos(dr)];
  const e = nrm(sub3(tan, sc(d, dot(tan, d))));
  return { g, d, e, ty: twist, tp: pitch };
}
const lin = (a: number, b: number, k: number) => a + (b - a) * k;

/** Builds a swing: wind-up angle → impact angle → follow-through angle, with wrist lag easing out at impact. */
function swingArc(f: (ang: number, lag: number, k: number) => WK, a0: number, aImp: number, a1: number, lag0: number, steps = 4): Arc {
  const keys: WK[] = [];
  for (let i = 0; i <= steps; i++) { const k = i / steps; keys.push(f(lin(a0, aImp, k), lin(lag0, 0, k * k), k * 0.6)); }
  const imp = keys.length - 1;
  keys.push(f(lin(aImp, a1, 0.55), -12, 0.8));
  keys.push(f(a1, -22, 1));
  return { keys, impact: imp };
}

function makeClass(o: { pole?: boolean; c: Vec; r: number; guard: WK; idle: WK; blocks: ClassAnims["blocks"]; twist: number; thrust: { back: WK; out: WK }; overR: number; overX: number; poleOverStab?: { ready: WK; out: WK } }): ClassAnims {
  const T = o.twist;
  // right-to-left: start behind the right shoulder, cut through the front, finish across the left
  if (o.pole) {
    // staff swings (ready_slashright_staff …): hands stay in front of the body, the shaft sweeps
    // the shaft pivots between the hands: keep the midpoint of the grip near the chest
    const mid = (w: WK): WK => { const half = sc(w.d, 0.225); return { ...w, g: sub3(add3(w.g, sc(sub3(w.g, o.c), -0.4)), half) }; };
    const right = swingArc((a, lag, k) => mid(hSwing(o.c, o.r, a, lin(0.3, 0.16, k), lag, lin(0.3, -0.02, k), 1, lin(-0.75 * T, 0.6 * T, k), lin(0, 0.1, k))), -80, 5, 55, 25);
    const left = swingArc((a, lag, k) => mid(hSwing(o.c, o.r, a, lin(0.3, 0.16, k), lag, lin(0.3, -0.02, k), -1, lin(0.7 * T, -0.6 * T, k), lin(0, 0.1, k))), 75, -5, -55, 25);
    const over = swingArc((b, lag, k) => mid(vSwing([o.c[0], 0.36, o.c[2] + 0.05], o.overR, b, lag, o.overX, lin(-0.2 * T, 0.1 * T, k), lin(-0.1, 0.24, k))), -10, 80, 112, 30);
    const thrust: Arc = { keys: [o.thrust.back, o.thrust.out, { ...o.thrust.out, g: add3(o.thrust.out.g, [0, -0.01, 0.02]) }], impact: 1 };
    return { guard: o.guard, idle: o.idle, arcs: { right, left, over, thrust }, blocks: o.blocks };
  }
  const right = swingArc((a, lag, k) => hSwing(o.c, o.r, a, lin(0.44, 0.2, k), lag, lin(0.5, -0.05, k), 1, lin(-0.85 * T, 0.75 * T, k), lin(-0.02, 0.12, k)), -150, 8, 85, 70);
  // left-to-right: start over the left shoulder (arm across the chest), cut to the right
  const left = swingArc((a, lag, k) => hSwing([o.c[0] + 0.04, o.c[1], o.c[2] + 0.08], o.r * 0.82, a, lin(0.42, 0.2, k), lag, lin(0.55, -0.05, k), -1, lin(0.75 * T, -0.75 * T, k), lin(-0.02, 0.12, k)), 120, -8, -90, 70);
  // overhead: from behind the head over the top, down through the front
  const over = swingArc((b, lag, k) => vSwing([o.c[0], 0.42, o.c[2] - 0.02], o.overR, b, lag, o.overX, lin(-0.25 * T, 0.1 * T, k), lin(-0.16, 0.34, k)), -55, 82, 150, 75);
  const thrust: Arc = o.poleOverStab && false ? { keys: [], impact: 0 } : { keys: [o.thrust.back, o.thrust.out, { ...o.thrust.out, g: add3(o.thrust.out.g, [0, -0.01, 0.02]) }], impact: 1 };
  const arcs: Record<Dir, Arc> = { right, left, over, thrust };
  if (o.poleOverStab) arcs.over = { keys: [o.poleOverStab.ready, o.poleOverStab.out, { ...o.poleOverStab.out, g: add3(o.poleOverStab.out.g, [0, -0.01, 0.02]) }], impact: 1 };
  return { guard: o.guard, idle: o.idle, arcs, blocks: o.blocks };
}

// Torso space: +X is the fighter's left, +Z forward, +Y up; origin at the waist (~1.05 m). Right shoulder ≈ (-0.17, 0.35, 0).
const OH = makeClass({
  c: [-0.1, 0, 0.02], r: 0.42, twist: 1, overR: 0.36, overX: -0.13,
  guard: K([-0.2, 0.16, 0.3], [0.1, 0.75, 0.65], [0, -0.65, 0.75], 0.12, 0.04),
  idle: K([-0.22, -0.2, 0.14], [0.05, -0.5, 0.86], [0, 0.86, 0.5], 0, 0),
  thrust: { back: K([-0.3, 0.06, -0.16], [0.1, 0.12, 0.99], [0, 1, -0.12], -0.75, 0.0), out: K([-0.1, 0.22, 0.58], [0.04, 0.02, 1], [0, 1, 0], 0.4, 0.16) },
  blocks: {   // parry_up / parry_right / parry_left / parry_forward (vs thrust)
    up: K([-0.14, 0.6, 0.28], [0.98, 0.14, 0.12], [0, 1, 0], 0.05, -0.05),
    right: K([-0.36, 0.22, 0.3], [-0.12, 0.98, 0.16], [-1, 0, 0], -0.35, 0),
    left: K([0.12, 0.26, 0.32], [0.18, 0.96, 0.18], [1, 0, 0], 0.4, 0),
    down: K([-0.08, 0.2, 0.38], [0.1, -0.96, 0.24], [1, 0, 0], 0.08, 0.1),
  },
});
const TH = makeClass({
  c: [-0.04, 0, 0.06], r: 0.36, twist: 1.05, overR: 0.3, overX: -0.06,
  guard: K([-0.1, 0.14, 0.34], [0.06, 0.62, 0.78], [0, -0.78, 0.62], 0.12, 0.05),
  idle: K([-0.1, -0.08, 0.28], [0.08, 0.72, 0.68], [0, -0.68, 0.72], 0.05, 0),
  thrust: { back: K([-0.2, 0.06, -0.06], [0.06, 0.12, 0.99], [0, 1, -0.12], -0.6, 0), out: K([-0.05, 0.2, 0.5], [0.02, 0.03, 1], [0, 1, 0], 0.32, 0.14) },
  blocks: {
    up: K([-0.02, 0.6, 0.26], [-0.99, 0.1, 0.05], [0, 1, 0], 0, -0.05),
    right: K([-0.22, 0.2, 0.34], [-0.1, 0.98, 0.12], [-1, 0, 0], -0.3, 0),
    left: K([0.2, 0.16, 0.32], [0.1, 0.98, 0.12], [1, 0, 0], 0.35, 0),
    down: K([-0.04, 0.42, 0.36], [0.05, -0.97, 0.2], [1, 0, 0], 0, 0.06),
  },
});
// Polearm: right fist at the rear of the grip, left fist 0.45 m up the shaft.
const PA = makeClass({
  pole: true, c: [-0.1, 0, 0.12], r: 0.1, twist: 0.8, overR: 0.18, overX: -0.08,
  guard: K([-0.2, -0.02, 0.04], [0.38, 0.14, 0.91], [0, 1, -0.15], 0.15, 0.06),
  idle: K([-0.22, -0.2, 0.1], [0.02, 1, 0.08], [1, 0, 0], 0, 0),
  // thrust_staff: drawn back low at the hip, driven forward and slightly up
  thrust: { back: K([-0.24, -0.04, -0.16], [0.42, 0.12, 0.9], [0, 1, -0.12], 0.35, -0.02), out: K([-0.16, 0.12, 0.12], [0.34, 0.04, 0.94], [0, 1, -0.05], -0.12, 0.18) },
  blocks: {
    up: K([-0.3, 0.58, 0.18], [1, 0.02, 0.04], [0, 1, 0], 0, -0.04),
    right: K([-0.3, -0.02, 0.3], [0.04, 0.99, 0.08], [-1, 0, 0], -0.2, 0),
    left: K([0.04, -0.02, 0.3], [0.06, 0.99, 0.08], [1, 0, 0], 0.25, 0),
    down: K([-0.1, 0.3, 0.24], [0.16, -0.98, 0.1], [1, 0, 0], 0, 0.06),
  },
});
// Spears use ready_overswing_spear: shaft lifted over the shoulder, stabbed down-forward.
const PA_SPEAR: ClassAnims = {
  ...PA,
  arcs: { ...PA.arcs, over: { keys: [K([-0.24, 0.46, -0.2], [0.18, 0.02, 0.98], [0, 1, 0.02], -0.35, -0.06), K([-0.14, 0.4, 0.13], [0.16, -0.4, 0.9], [0, 0.9, 0.4], 0.18, 0.22), K([-0.13, 0.38, 0.15], [0.16, -0.45, 0.88], [0, 0.88, 0.45], 0.2, 0.24)], impact: 1 } },
};
const CLASSES: Record<WClass, ClassAnims> = { oh: OH, th: TH, pa: PA };
function classFor(w: WeaponId): ClassAnims { return w === "spear" ? PA_SPEAR : CLASSES[WEAPONS[w].cls]; }

/** Warband native timings at weapon speed 100 (seconds). */
export const TIMING = { ready: 0.35, hold: 0.3, release: 0.2, cont: 0.28, recover: 0.32, gap: 0.22, parried: 0.32, blockIn: 0.12, blockHold: 0.5 };

type Ease = "smooth" | "in" | "out" | "lin";
type Seg = { t: number; k: WK; ease: Ease; block?: string; label: string };

/** Builds the demo loop for the lab; the game drives the same pieces from input. */
function timeline(w: WeaponId, move: Move, shield: boolean): Seg[] {
  const spec = WEAPONS[w], A = classFor(w), Tm = TIMING;
  const out: Seg[] = [{ t: 0, k: A.guard, ease: "smooth", label: "garda" }];
  let t = Tm.gap;
  const push = (dt: number, k: WK, ease: Ease, label: string, block?: string) => { t += dt; out.push({ t, k, ease, block, label }); };
  const attack = (d0: Dir, outcome: "hit" | "parried") => {
    const d = d0 === "thrust" && !spec.thrust ? "over" : d0;   // axes and maces: thrust becomes an overhead
    const arc = A.arcs[d];
    out.push({ t, k: A.guard, ease: "smooth", label: "garda" });
    push(Tm.ready, arc.keys[0], "out", "zamach");                 // ready_
    push(Tm.hold, { ...arc.keys[0], g: add3(arc.keys[0].g, [0, 0.008, -0.01]) }, "smooth", "trzymanie");
    const n = arc.impact;
    for (let i = 1; i <= n; i++) push(Tm.release / n, arc.keys[i], i === 1 ? "in" : "lin", "cios");   // release_
    if (outcome === "parried") {
      // parried_: the release reversed back toward the ready pose, then home
      push(Tm.parried * 0.55, arc.keys[Math.max(0, n - 2)], "out", "odbity");
      push(Tm.parried * 0.45, arc.keys[Math.max(0, n - 3)], "smooth", "odbity");
      push(Tm.recover, A.guard, "smooth", "powrót");
    } else {
      for (let i = n + 1; i < arc.keys.length; i++) push(Tm.cont / (arc.keys.length - 1 - n), arc.keys[i], i === arc.keys.length - 1 ? "out" : "lin", "dokończenie");   // release_continue
      push(Tm.recover, A.guard, "smooth", "powrót");
    }
    t += Tm.gap;
  };
  const dirs: Dir[] = ["over", "right", "left", "thrust"];
  if (move === "all") dirs.forEach((d) => attack(d, "hit"));
  else if (move === "parried") dirs.forEach((d) => attack(d, "parried"));
  else if (move !== "blocks") attack(move as Dir, "hit");
  if (move === "all" || move === "blocks") {
    for (const b of ["up", "right", "left", "down"] as const) {
      const k = shield ? A.guard : A.blocks[b];
      out.push({ t, k: A.guard, ease: "smooth", label: "garda" });
      push(Tm.blockIn, k, "out", "blok", b);
      push(Tm.blockHold, k, "smooth", "blok", b);
      push(0.2, A.guard, "smooth", "garda");
      t += 0.1;
    }
  }
  out.push({ t: t + 0.25, k: A.guard, ease: "smooth", label: "garda" });
  return out;
}

const nlerp = (a: Vec, b: Vec, k: number): Vec => nrm([lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]);
function easeK(e: Ease, k: number) { return e === "in" ? k * k : e === "out" ? 1 - (1 - k) * (1 - k) : e === "lin" ? k : k * k * (3 - 2 * k); }
function sampleTL(tl: Seg[], t: number): { k: WK; block: string | null; label: string } {
  const len = tl[tl.length - 1].t;
  t = ((t % len) + len) % len;
  let i = 0;
  while (i < tl.length - 2 && t >= tl[i + 1].t) i++;
  const a = tl[i], b = tl[i + 1];
  const k = easeK(b.ease, b.t > a.t ? (t - a.t) / (b.t - a.t) : 1);
  const g: Vec = [lerp(a.k.g[0], b.k.g[0], k), lerp(a.k.g[1], b.k.g[1], k), lerp(a.k.g[2], b.k.g[2], k)];
  const blk = (b.block && k > 0.3) ? b.block : a.block && k < 0.7 ? a.block : null;
  return { k: { g, d: nlerp(a.k.d, b.k.d, k), e: nlerp(a.k.e, b.k.e, k), ty: lerp(a.k.ty, b.k.ty, k), tp: lerp(a.k.tp, b.k.tp, k) }, block: blk ?? null, label: b.label };
}
export function loopLength(w: WeaponId, move: Move, shield = false) { const tl = timeline(w, move, shield); return tl[tl.length - 1].t; }
export function phaseAt(w: WeaponId, move: Move, shield: boolean, t: number) { return sampleTL(timeline(w, move, shield), t).label; }

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
  let key: WK | null = null, blocking = false, legs: Pose["r"] = {}, bob = 0, shieldDir: string | null = null;
  const pose: Pose = { r: {} };
  const walking = kind === "walk" || kind === "walkcombat";
  let walkTorso: V3 = [0, 0, 0], walkPelvis: V3 = [0, 0, 0], s = 0;
  if (walking) {
    s = Math.sin(t * 5.2); const c = Math.cos(t * 5.2);
    const leg = (ph: number) => {
      const sw = Math.sin(t * 5.2 + ph), knee = Math.max(0, Math.cos(t * 5.2 + ph)) * 0.75 + 0.06;
      return { thigh: [-sw * 0.45, 0, 0] as V3, shin: [knee, 0, 0] as V3, foot: [-sw * 0.15 - 0.05, 0, 0] as V3 };
    };
    const l = leg(0), r = leg(Math.PI);
    legs = { thighL: l.thigh, shinL: l.shin, footL: l.foot, thighR: r.thigh, shinR: r.shin, footR: r.foot };
    walkPelvis = [0, s * 0.06, 0]; walkTorso = [0.05, -s * 0.09, 0];
    bob = Math.abs(c) * 0.035;
  }

  if (kind === "t") {
    pose.r = { uarmL: [0, 0, Math.PI / 2], uarmR: [0, 0, -Math.PI / 2], handR: [0.9, 0, 0] };
  } else if (kind === "walk") {
    pose.r = { pelvis: walkPelvis, torso: walkTorso, head: [-0.03, s * 0.05, 0], uarmL: shieldArm ? [s * 0.15 - 0.1, 0, 0.2] : [s * 0.42, 0, 0.1], farmL: [-0.3 - Math.max(0, s) * 0.3, 0, 0] };
    if (spec) { const id = classFor(spec.id).idle; key = { ...id, g: add3(id.g, [0, Math.abs(s) * 0.02, 0]) }; }
  } else if (kind === "idle") {
    const br = Math.sin(t * 1.6) * 0.015;
    pose.r = { torso: [br, 0, 0], head: [-br, 0, 0], uarmL: shieldArm ? [-0.05, 0, 0.22] : [0.04, 0, 0.13], farmL: [-0.18, 0, 0], handL: [0, 0, 0.05] };
    legs = { thighL: [0, 0, 0.02], thighR: [0, 0, -0.02], shinL: [0.03, 0, 0], shinR: [0.03, 0, 0] };
    if (spec) key = classFor(spec.id).idle;
  } else if (spec) {
    // combat: upper body from the attack, lower body planted (or walking, layered like Warband)
    const smp = sampleTL(timeline(spec.id, eq.move ?? "all", shieldArm), t);
    key = smp.k; blocking = !!smp.block; shieldDir = smp.block;
    if (!walking) { legs = STANCE; bob = -0.02; }
    const sb = shieldArm && blocking;
    pose.r = {
      pelvis: add3(walkPelvis, [0, key.ty * 0.3, 0]) as V3, torso: add3(walkTorso, [key.tp, key.ty * 0.62, 0]) as V3, head: [-key.tp * 0.6, -key.ty * 0.55, 0],
      uarmL: shieldArm ? (sb ? (shieldDir === "up" ? [-1.75, 0.3, 0.25] : [-1.2, 0.35, 0.2]) : [-0.75, 0.25, 0.12]) : [-0.3, 0.2, 0.25],
      farmL: shieldArm ? [sb ? (shieldDir === "up" ? -0.9 : -1.25) : -1.15, 0, 0] : [-0.95, 0, 0], handL: [0, 0, 0],
    };
  }
  pose.r = { ...pose.r, ...legs };
  pose.bob = bob;

  // shield-bearers block with the shield (defend_shield_*); the weapon waits in guard
  // weapon drawn back and up beside the head, out of the shield's way (defend_shield_* keeps it there)
  if ((kind === "combat" || kind === "walkcombat") && shieldArm && blocking && spec) key = K([-0.3, 0.3, 0.02], [-0.12, 0.85, -0.5], [-1, 0, 0], -0.15, 0);

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
    const combat = kind === "combat" || kind === "walkcombat";
    if (!combat) {
      // carried at the side on the forearm straps
      const p = xform(J.farmL, 0, -0.14, 0);
      const fwd = nrm(tdir(J.torso, [0, 0, 1])), side = nrm(tdir(J.torso, [1, 0, 0]));
      const out = sc(side, 0.075);
      shield = trs(m4(), p[0] + out[0], p[1] + out[1], p[2] + out[2], Math.atan2(fwd[0], fwd[2]) + Math.PI / 2 - 0.15, 0.05, 0);
    } else {
      // shield placed relative to the chest, then the left arm reaches into its straps (IK)
      let pos: Vec = [0.2, 0.2, 0.3], yaw = 0.25, pitch = -0.08;
      if (blocking) {
        pos = [0.06, 0.3, 0.42]; yaw = 0.05; pitch = -0.04;              // defend_shield_forward
        if (shieldDir === "up") { pos = [0.04, 0.52, 0.34]; pitch = -0.85; }
        if (shieldDir === "left") { pos = [0.2, 0.3, 0.38]; yaw = 0.55; }
        if (shieldDir === "right") { pos = [-0.12, 0.3, 0.4]; yaw = -0.4; }
        if (shieldDir === "down") { pos = [0.06, 0.18, 0.42]; pitch = 0.18; }
      }
      const J0 = solve(m4(), pose);
      const local = mul(m4(), J0.torso, trs(m4(), pos[0], pos[1], pos[2], yaw, pitch, 0));
      const hand = xform(local, 0.11, -0.02, -0.055) as Vec;
      const axis = nrm(tdir(local, [0, 1, 0]));
      ikArm("L", pose, J0, hand, axis);
      J = solve(root, pose);
      shield = mul(m4(), root, local);
    }
  }
  return { J, weapon, shield, blocking };
}
