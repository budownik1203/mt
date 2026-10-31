// A fighter: body built from procedural parts, a combat state machine and
// pose-blended procedural animation. Player and AI share this class.
import { Mat4, m4, mul, trs, xform, lerp, clamp, wrapAngle, V3 } from "../core/math.ts";
import { MeshBuilder, T, hex, RGB } from "../gfx/meshbuilder.ts";
import { Renderer, Mesh, DrawItem } from "../gfx/renderer.ts";
import { Weapon, Armour, Dir, DIR, timings, effectiveDir } from "./combat.ts";

export type State = "idle" | "windup" | "hold" | "release" | "recover" | "block" | "stagger" | "blockstun" | "dead";

export interface Kit {
  name: { pl: string; en: string };
  weapon: Weapon;
  armour: Armour;
  shield: boolean;
  colors: { skin: number; cloth: number; armour: number; legs: number; helm: number; trim: number };
  helm: "hood" | "kettle" | "greathelm" | "bare" | "nasal";
  hp: number;
  skill: number;   // 0..1 for AI
}

interface Pose {
  tY: number; tP: number;
  rS: V3; rE: number; rW: V3;
  lS: V3; lE: number;
  shield: number; // 0 lowered .. 1 raised
}

const P = (tY: number, tP: number, rS: V3, rE: number, rW: V3, lS: V3 = [-0.4, 0, 0.15], lE = -0.9, shield = 0.4): Pose =>
  ({ tY, tP, rS, rE, rW, lS, lE, shield });

// Right arm hangs along -Y; rS = shoulder (ry, rx, rz) in Ry*Rx*Rz order given as [rx, ry, rz].
// Weapon points along the hand's +Z.
const GUARD = P(0, 0.05, [-0.35, 0, -0.15], -1.35, [0.25, 0, 0]);
const WIND: Record<Dir, Pose> = {
  [DIR.OVER]: P(-0.15, -0.1, [-2.85, -0.2, -0.25], -1.0, [-0.2, 0, 0]),
  [DIR.RIGHT]: P(-0.75, 0.05, [-1.35, -1.25, 0], -0.55, [1.45, 0, 0.3]),
  [DIR.LEFT]: P(0.6, 0.05, [-1.3, 1.0, 0.25], -0.9, [1.55, 0, -0.3]),
  [DIR.THRUST]: P(-0.35, 0, [-0.5, -0.3, -0.35], -1.75, [2.2, 0, 0]),
};
const STRIKE: Record<Dir, Pose> = {
  [DIR.OVER]: P(0.15, 0.3, [-1.15, 0.05, 0], -0.15, [1.05, 0, 0]),
  [DIR.RIGHT]: P(0.7, 0.1, [-1.45, 1.1, 0], -0.1, [1.5, 0, 0.2]),
  [DIR.LEFT]: P(-0.65, 0.1, [-1.45, -1.15, 0], -0.1, [1.5, 0, -0.2]),
  [DIR.THRUST]: P(0.2, 0.15, [-1.55, 0.1, 0], 0, [1.5, 0, 0]),
};
// Block poses named by the side the defender covers.
const BLOCK: Record<Dir, Pose> = {
  [DIR.OVER]: P(0, -0.05, [-2.35, 0.1, -0.1], -0.45, [0, 1.57, 0], [-2.0, 0, 0.2], -0.5, 1),
  [DIR.RIGHT]: P(-0.3, 0, [-0.85, -0.65, -0.35], -1.15, [0, 0, 0], undefined, undefined, 1),
  [DIR.LEFT]: P(0.35, 0, [-1.05, 0.8, 0.3], -1.0, [0, 0, 0], undefined, undefined, 1),
  [DIR.THRUST]: P(0, 0, [-0.85, 0.05, 0.05], -1.05, [0, 0, 0], undefined, undefined, 1),
};

function blend(a: Pose, b: Pose, t: number): Pose {
  const l3 = (x: V3, y: V3): V3 => [lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)];
  return { tY: lerp(a.tY, b.tY, t), tP: lerp(a.tP, b.tP, t), rS: l3(a.rS, b.rS), rE: lerp(a.rE, b.rE, t), rW: l3(a.rW, b.rW),
    lS: l3(a.lS, b.lS), lE: lerp(a.lE, b.lE, t), shield: lerp(a.shield, b.shield, t) };
}

function weaponMesh(w: Weapon): MeshBuilder {
  const b = new MeshBuilder();
  const steel = hex(0x8c8f93), dark = hex(0x3a3734), wood = hex(0x5b442f), brass = hex(0x8a6d3b);
  switch (w.look) {
    case "sword":
      b.box(T(0, 0, -0.04), 0.035, 0.035, 0.18, dark);
      b.rock(T(0, 0, -0.14), 0.035, brass, 0.1);
      b.box(T(0, 0, 0.06), 0.22, 0.035, 0.04, brass);
      b.box(T(0, 0, 0.47), 0.065, 0.014, 0.78, steel);
      b.cyl(T(0, 0, 0.86, 0, Math.PI / 2, Math.PI / 4), 0.045, 0, 0.1, 4, steel);
      break;
    case "greataxe":
      b.box(T(0, 0, 0.25), 0.04, 0.04, 1.25, wood);
      b.box(T(0, -0.13, 0.78), 0.02, 0.26, 0.12, dark);
      b.box(T(0, -0.25, 0.78), 0.015, 0.14, 0.36, steel);
      break;
    case "axe":
      b.box(T(0, 0, 0.18), 0.035, 0.035, 0.6, wood);
      b.box(T(0, -0.09, 0.42), 0.02, 0.16, 0.08, dark);
      b.box(T(0, -0.16, 0.42), 0.015, 0.06, 0.2, steel);
      break;
    case "mace":
      b.box(T(0, 0, 0.18), 0.035, 0.035, 0.58, dark);
      for (let i = 0; i < 6; i++) b.box(T(0, 0, 0.47, (i / 6) * Math.PI), 0.16, 0.03, 0.14, steel);
      b.rock(T(0, 0, 0.47), 0.05, steel, 0.05);
      break;
    case "spear":
      b.box(T(0, 0, 0.45), 0.035, 0.035, 2.2, wood);
      b.cyl(T(0, 0, 1.55, 0, Math.PI / 2), 0.04, 0, 0.32, 4, steel);
      break;
  }
  return b;
}

function shieldMesh(c: RGB, trim: RGB): MeshBuilder {
  const b = new MeshBuilder();
  // heater shield, face toward +Z
  b.box(T(0, 0.08, 0), 0.56, 0.48, 0.05, c);
  const tri = (y: number, w: number) => [[-w, y, 0.03], [w, y, 0.03], [0, -0.5, 0.03]];
  const t = tri(-0.16, 0.28); b.tri(t[0], t[2], t[1], c);
  const t2 = [[-0.28, -0.16, -0.03], [0.28, -0.16, -0.03], [0, -0.5, -0.03]]; b.tri(t2[0], t2[1], t2[2], c);
  b.box(T(0, 0.08, 0.03), 0.08, 0.5, 0.012, trim);
  b.box(T(0, 0.12, 0.03), 0.5, 0.07, 0.012, trim);
  return b;
}

let nextId = 1;

export class Fighter {
  id = nextId++;
  x: number; z: number; y = 0;
  yaw = 0;
  vx = 0; vz = 0;
  hp: number; maxHp: number;
  state: State = "idle";
  t = 0;                 // time in state
  dir: Dir = DIR.OVER;   // current attack or block direction
  hitDone = false;
  walkPhase = 0;
  deadT = 0;
  flash = 0;
  pose: Pose = GUARD;
  team: number;
  wish = { x: 0, z: 0, run: false };   // desired move in world space
  radius = 0.38;
  hidden = new Set<string>();
  kit: Kit;
  mesh: Record<string, Mesh> = {};
  hand: Mat4 = m4();
  bladeTip: V3 = [0, 0, 0];
  lastHitBy = 0;
  aiToken = false;
  attackSeq = 0;

  constructor(r: Renderer, kit: Kit, x: number, z: number, team: number) {
    this.kit = kit; this.x = x; this.z = z; this.team = team;
    this.hp = this.maxHp = kit.hp;
    this.buildMeshes(r);
  }

  get weapon() { return this.kit.weapon; }
  get alive() { return this.state !== "dead"; }
  get tm() { return timings(this.kit.weapon); }
  get attacking() { return this.state === "windup" || this.state === "hold" || this.state === "release"; }

  buildMeshes(r: Renderer) {
    const c = this.kit.colors;
    const skin = hex(c.skin), cloth = hex(c.cloth), arm = hex(c.armour), legs = hex(c.legs), helm = hex(c.helm), trim = hex(c.trim);
    const boots = hex(0x2c241d);
    const mk = (f: (b: MeshBuilder) => void) => { const b = new MeshBuilder(); f(b); return r.upload(b); };
    this.mesh.pelvis = mk((b) => { b.box(T(0, 0, 0), 0.36, 0.22, 0.24, legs); b.box(T(0, -0.16, 0.02), 0.4, 0.3, 0.28, cloth); });
    this.mesh.torso = mk((b) => {
      b.box(T(0, 0.3, 0), 0.44, 0.56, 0.27, arm);
      b.box(T(0, 0.04, 0), 0.42, 0.07, 0.29, hex(0x2b221b));
      b.box(T(0, 0.3, 0.14), 0.16, 0.5, 0.01, trim);
      b.box(T(0.25, 0.52, 0), 0.14, 0.12, 0.2, arm); b.box(T(-0.25, 0.52, 0), 0.14, 0.12, 0.2, arm);
    });
    this.mesh.head = mk((b) => {
      b.box(T(0, 0.13, 0.01), 0.2, 0.24, 0.21, skin);
      b.box(T(0, -0.02, 0), 0.1, 0.08, 0.1, skin);
      switch (this.kit.helm) {
        case "hood": b.box(T(0, 0.16, -0.02), 0.26, 0.3, 0.26, cloth); b.box(T(0, 0.02, -0.02), 0.32, 0.1, 0.3, cloth); break;
        case "kettle": b.cyl(T(0, 0.22, 0), 0.13, 0.06, 0.13, 7, helm); b.cyl(T(0, 0.2, 0), 0.24, 0.2, 0.04, 8, helm); break;
        case "nasal": b.cyl(T(0, 0.17, 0), 0.13, 0.02, 0.2, 6, helm); b.box(T(0, 0.12, 0.12), 0.03, 0.12, 0.02, helm); break;
        case "greathelm": b.box(T(0, 0.14, 0), 0.25, 0.3, 0.26, helm); b.box(T(0, 0.17, 0.131), 0.2, 0.025, 0.01, hex(0x111111)); b.box(T(0, 0.08, 0.131), 0.02, 0.12, 0.01, trim); break;
        case "bare": b.box(T(0, 0.25, -0.01), 0.21, 0.04, 0.22, hex(0x2b2118)); break;
      }
    });
    this.mesh.uarm = mk((b) => b.box(T(0, -0.15, 0), 0.12, 0.32, 0.12, arm));
    this.mesh.farm = mk((b) => { b.box(T(0, -0.13, 0), 0.1, 0.28, 0.1, arm); b.box(T(0, -0.29, 0), 0.09, 0.09, 0.09, skin); });
    this.mesh.thigh = mk((b) => b.box(T(0, -0.22, 0), 0.15, 0.45, 0.15, legs));
    this.mesh.shin = mk((b) => { b.box(T(0, -0.22, 0), 0.12, 0.45, 0.13, legs); b.box(T(0, -0.46, 0.05), 0.13, 0.08, 0.26, boots); });
    this.mesh.weapon = r.upload(weaponMesh(this.kit.weapon));
    if (this.kit.shield) this.mesh.shield = r.upload(shieldMesh(hex(c.cloth), trim));
  }

  enter(s: State, d?: Dir) {
    this.state = s; this.t = 0;
    if (d !== undefined) this.dir = d;
    if (s === "release") this.hitDone = false;
  }

  /** Begin an attack. Returns false if busy. */
  attack(d: Dir): boolean {
    if (!(this.state === "idle" || this.state === "block")) return false;
    this.enter("windup", effectiveDir(this.weapon, d));
    this.attackSeq++;
    return true;
  }
  /** Feint: cancel a windup into a block like M&B. */
  feint(d: Dir) { if (this.state === "windup" || this.state === "hold") this.enter("block", d); }
  release() { if (this.state === "hold") this.enter("release"); }
  block(d: Dir) {
    if (this.state === "idle") this.enter("block", d);
    else if (this.state === "block") this.dir = d;
  }
  unblock() { if (this.state === "block") this.enter("idle"); }

  stagger() { if (this.alive) this.enter("stagger"); }

  update(dt: number, holdAttack: boolean) {
    this.t += dt;
    const tm = this.tm;
    switch (this.state) {
      case "windup": if (this.t >= tm.windup) this.enter(holdAttack ? "hold" : "release"); break;
      case "hold": if (!holdAttack || this.t > 3) this.enter("release"); break;
      case "release": if (this.t >= tm.release) this.enter("recover"); break;
      case "recover": if (this.t >= tm.recover) this.enter("idle"); break;
      case "stagger": if (this.t >= tm.stagger) this.enter("idle"); break;
      case "blockstun": if (this.t >= tm.blockStun) this.enter("idle"); break;
      case "dead": this.deadT += dt; break;
    }
    this.flash = Math.max(0, this.flash - dt * 4);
  }

  /** Normalised moment in the release phase when the blow connects. */
  get impactNow() { return this.state === "release" && !this.hitDone && this.t >= this.tm.release * 0.45; }

  move(dt: number, ground: (x: number, z: number) => number) {
    let sp = this.wish.run ? 5.4 : 3.3;
    if (this.state === "windup" || this.state === "hold") sp *= 0.62;
    if (this.state === "block") sp *= 0.6;
    if (this.state === "stagger" || this.state === "blockstun" || this.state === "release") sp *= 0.35;
    if (!this.alive) sp = 0;
    // walking backwards is slower
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const back = this.wish.x * fx + this.wish.z * fz < -0.3;
    if (back) sp *= 0.65;
    const tx = this.wish.x * sp, tz = this.wish.z * sp;
    const k = clamp(dt * 9, 0, 1);
    this.vx = lerp(this.vx, tx, k); this.vz = lerp(this.vz, tz, k);
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.y = ground(this.x, this.z);
    const speed = Math.hypot(this.vx, this.vz);
    this.walkPhase += dt * speed * 2.6 * (back ? -1 : 1);
  }

  faceTo(yaw: number, dt: number, rate = 8) {
    const d = wrapAngle(yaw - this.yaw);
    this.yaw = wrapAngle(this.yaw + clamp(d, -rate * dt, rate * dt));
  }

  private targetPose(): Pose {
    const tm = this.tm, d = this.dir;
    switch (this.state) {
      case "windup": return blend(GUARD, WIND[d], Math.min(1, this.t / tm.windup) ** 0.7);
      case "hold": {
        const w = WIND[d], s = Math.sin(this.t * 9) * 0.02;
        return { ...w, tY: w.tY + s };
      }
      case "release": return blend(WIND[d], STRIKE[d], Math.min(1, (this.t / tm.release) * 1.15) ** 1.6);
      case "recover": return blend(STRIKE[d], GUARD, Math.min(1, this.t / tm.recover));
      case "block": return blend(this.pose, BLOCK[d], Math.min(1, this.t / 0.12));
      case "blockstun": return blend(STRIKE[d], GUARD, Math.min(1, this.t / tm.blockStun) * 0.6);
      case "stagger": { const p = blend(GUARD, P(0.3, -0.35, [-0.1, 0.2, -0.6], -0.4, [0.6, 0, 0]), Math.sin(Math.min(1, this.t / 0.45) * Math.PI)); return p; }
      default: return GUARD;
    }
  }

  /** Builds world matrices for all parts and appends draw items. */
  draw(items: DrawItem[]) {
    const tp = this.targetPose();
    // smooth pose transitions, faster during swings so they stay crisp
    const k = this.state === "release" ? 1 : 0.35;
    this.pose = blend(this.pose, tp, k);
    const p = this.pose;
    const speed = Math.hypot(this.vx, this.vz);
    const gait = clamp(speed / 3.3, 0, 1.5);
    const ph = this.walkPhase;
    const bob = Math.abs(Math.sin(ph)) * 0.04 * gait;

    const tint: [number, number, number, number] | undefined = this.flash > 0 ? [0.7, 0.05, 0.03, this.flash * 0.6] : undefined;
    const add = (name: string, m: Mat4, part = name) => {
      if (this.hidden.has(part)) return;
      items.push({ mesh: this.mesh[name], model: m, tint });
    };

    // root, with death fall
    const root = trs(m4(), this.x, this.y, this.z, this.yaw);
    if (!this.alive) {
      const f = clamp(this.deadT / 0.7, 0, 1);
      const fall = trs(m4(), 0, 0, 0, 0, -f * f * 1.5, 0);
      const sink = trs(m4(), 0, -f * 0.08, -f * 0.1);
      mul(root, root, sink); mul(root, root, fall);
    }
    const pelvis = mul(m4(), root, trs(m4(), 0, 0.98 + bob - (this.alive ? 0 : 0), 0, p.tY * 0.3, 0, Math.sin(ph) * 0.04 * gait));
    add("pelvis", pelvis);
    const torso = mul(m4(), pelvis, trs(m4(), 0, 0.1, 0, p.tY * 0.7, p.tP + gait * 0.08, 0));
    add("torso", torso);
    const head = mul(m4(), torso, trs(m4(), 0, 0.62, 0.01, -p.tY * 0.5, -p.tP * 0.5));
    add("head", head);

    // right arm (at -X)
    const rs = mul(m4(), torso, trs(m4(), -0.25, 0.5, 0, p.rS[1], p.rS[0], p.rS[2]));
    add("uarm", rs, "rarm");
    const re = mul(m4(), rs, trs(m4(), 0, -0.3, 0, 0, p.rE));
    add("farm", re, "rarm");
    this.hand = mul(m4(), re, trs(m4(), 0, -0.29, 0, p.rW[1], p.rW[0], p.rW[2]));
    add("weapon", this.hand, "weapon");
    this.bladeTip = xform(this.hand, 0, 0, this.weapon.look === "spear" ? 1.7 : 0.9);

    // left arm
    let ls: V3 = p.lS, le = p.lE;
    if (this.weapon.twoHanded) { ls = [p.rS[0] + 0.15, p.rS[1] + 0.35, -p.rS[2] * 0.3]; le = p.rE - 0.15; }
    const lsm = mul(m4(), torso, trs(m4(), 0.25, 0.5, 0, ls[1], ls[0], ls[2]));
    add("uarm", lsm, "larm");
    const lem = mul(m4(), lsm, trs(m4(), 0, -0.3, 0, 0, le));
    add("farm", lem, "larm");
    if (this.mesh.shield) {
      const sh = p.shield;
      const sm = mul(m4(), torso, trs(m4(), lerp(0.32, 0.12, sh), lerp(0.18, 0.42, sh), lerp(0.22, 0.42, sh), lerp(0.5, 0.05, sh), lerp(0.15, -0.05, sh), lerp(0.15, 0, sh)));
      add("shield", sm, "shield");
    }

    // legs
    const swing = Math.sin(ph) * 0.55 * gait;
    const legsAlive = this.alive ? 1 : 0.2;
    for (const side of [-1, 1]) {
      const s = side * swing * legsAlive;
      const hip = mul(m4(), pelvis, trs(m4(), side * 0.11, -0.06, 0, 0, -s));
      add("thigh", hip, "legs");
      const knee = mul(m4(), hip, trs(m4(), 0, -0.45, 0, 0, Math.max(0, s) * 1.1 + 0.05 * gait + (this.alive ? 0 : 0.4)));
      add("shin", knee, "legs");
    }
  }

  /** Point at chest height, used by the camera and HUD. */
  get chest(): V3 { return [this.x, this.y + 1.45, this.z]; }
  get eye(): V3 {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    return [this.x + fx * 0.12, this.y + 1.68, this.z + fz * 0.12];
  }
}
