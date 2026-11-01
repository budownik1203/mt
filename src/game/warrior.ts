// A fighter for build 1: Warband-style combat state machine driving the new
// character rig (human + gear + weapon) through runtime animation tracks.
import { Mat4, m4, mul, trs, clamp, lerp, wrapAngle } from "../core/math.ts";
import { PSX, GMesh } from "../char/psx.ts";
import { LEVELS, buildHuman, Joint } from "../char/human.ts";
import { buildGear, Loadout } from "../char/gear.ts";
import { buildWeapon, buildShield, WeaponId, WEAPONS } from "../char/weapons.ts";
import { frame, makeTrack, sampleTrack, trackLength, guardKey, Track, WK, AttackDir, BlockDir } from "../char/anim.ts";
import { Armour, DmgType, Dir, DIR } from "./combat.ts";

/** Combat stats per weapon (the animation only depends on the class). */
export interface WStats { reach: number; speed: number; mass: number; swing: { dmg: number; type: DmgType } | null; thrust: { dmg: number; type: DmgType } | null }
export const WSTATS: Record<WeaponId, WStats> = {
  sword: { mass: 1.0, reach: 1.05, speed: 1.0, swing: { dmg: 31, type: "cut" }, thrust: { dmg: 25, type: "pierce" } },
  kord: { mass: 0.9, reach: 0.85, speed: 1.08, swing: { dmg: 29, type: "cut" }, thrust: { dmg: 23, type: "pierce" } },
  hatchet: { mass: 1.0, reach: 0.8, speed: 1.06, swing: { dmg: 30, type: "cut" }, thrust: null },
  mace: { mass: 1.15, reach: 0.85, speed: 1.02, swing: { dmg: 28, type: "blunt" }, thrust: null },
  longsword: { mass: 1.3, reach: 1.3, speed: 0.9, swing: { dmg: 38, type: "cut" }, thrust: { dmg: 30, type: "pierce" } },
  greataxe: { mass: 1.6, reach: 1.1, speed: 0.8, swing: { dmg: 46, type: "cut" }, thrust: null },
  spear: { mass: 1.15, reach: 1.85, speed: 0.95, swing: { dmg: 16, type: "blunt" }, thrust: { dmg: 36, type: "pierce" } },
  glaive: { mass: 1.45, reach: 1.95, speed: 0.88, swing: { dmg: 36, type: "cut" }, thrust: { dmg: 28, type: "pierce" } },
};

export interface Kit {
  name: { pl: string; en: string };
  loadout: Loadout; weapon: WeaponId; shield: boolean;
  armour: Armour; hp: number; skill: number;
}

export type State = "idle" | "windup" | "hold" | "release" | "recover" | "block" | "stagger" | "blockstun" | "dead";
const ANIM_DIR: AttackDir[] = ["over", "right", "left", "thrust"];
const BLOCK_DIR: BlockDir[] = ["up", "right", "left", "down"];

// ---------- mesh cache: one set of GPU meshes per (loadout, weapon, shield) ----------
export interface CharMesh { parts: { joint: Joint; mesh: GMesh }[]; weapon: GMesh; shield: GMesh | null }
const meshCache = new Map<string, CharMesh>();
export function charMesh(R: PSX, kit: Kit): CharMesh {
  const sh = shieldMode(kit);
  const key = `${kit.loadout}|${kit.weapon}|${sh}`;
  const hit = meshCache.get(key);
  if (hit) return hit;
  const L = LEVELS.hfa;
  const g = buildGear(L, kit.loadout);
  const twoHand = WEAPONS[kit.weapon].offhand !== 0;
  const h = buildHuman(L, { fistR: true, fistL: twoHand, hide: g.hide });
  const parts = h.parts.map((p) => ({ joint: p.joint, mesh: R.upload(p.mesh, 0, false) }))
    .concat(g.pieces.map((p) => ({ joint: p.joint, mesh: R.upload(p.mesh, p.tex, false) })));
  parts.sort((a, b) => a.mesh.tex - b.mesh.tex);
  const cm: CharMesh = { parts, weapon: R.upload(buildWeapon(kit.weapon, L.smooth, L.limb), 1, false), shield: sh !== "none" ? R.upload(buildShield(), 1, false) : null };
  meshCache.set(key, cm);
  return cm;
}
function shieldMode(kit: Kit): "none" | "arm" | "back" {
  if (!kit.shield) return "none";
  return WEAPONS[kit.weapon].cls === "oh" ? "arm" : "back";
}

let nextId = 1;
/** Global combat tempo: below 1 = slower, heavier swings. */
export const TEMPO = 0.78;

export class Warrior {
  id = nextId++;
  x: number; z: number; y = 0; yaw = 0;
  vx = 0; vz = 0;
  wish = { x: 0, z: 0, run: false };
  radius = 0.38;
  hp: number; maxHp: number;
  state: State = "idle";
  t = 0;                       // time in state
  dir: Dir = DIR.OVER;         // current attack or block direction (combat numbering)
  hitDone = false;
  attackSeq = 0;
  aiToken = false;
  aiHold = 0;                  // AI: how long to keep a readied attack
  deadT = 0;
  flash = 0;
  walkT = 0;
  lastHitBy = 0;
  team: number;
  kit: Kit;
  mesh!: CharMesh;
  track: Track; trackT = 0;
  cur: WK;
  hideHead = false;
  weaponMat: Mat4 | null = null;
  shieldMat: Mat4 | null = null;
  lastJ: Record<Joint, Mat4> | null = null;
  severed = new Set<Joint>();
  aimY = 0;
  /** Wanted vertical aim (rad, + up / - down) and the smoothed body lean that follows it. */
  aim = 0; lean = 0;
  /** Attack lockout after being parried / blocked / hit; riposte window after a successful block. */
  cd = 0; riposte = 0; boost = 1;
  /** Hit-stop (both fighters freeze for a few frames when steel meets flesh or steel). */
  freeze = 0;
  /** Body reaction to a blow: torso pitch / yaw / roll, springs back. */
  react: [number, number, number] = [0, 0, 0]; reactV: [number, number, number] = [0, 0, 0];
  /** Knock-back / lunge velocity on top of walking. */
  kx = 0; kz = 0;
  /** Battle command and morale (build 6). */
  moveMul = 1;
  group = 1; morale = 60; baseMorale = 60; fleeing = false; noMorale = false; bearer = false; leader = false;

  constructor(R: PSX, kit: Kit, x: number, z: number, team: number) {
    this.kit = kit; this.x = x; this.z = z; this.team = team;
    this.hp = this.maxHp = kit.hp;
    this.cur = guardKey(kit.weapon);
    this.track = makeTrack(kit.weapon, this.cur, "guard");
    this.setKit(R, kit);
  }

  setKit(R: PSX, kit: Kit) {
    this.kit = kit; this.mesh = charMesh(R, kit);
    this.cur = guardKey(kit.weapon); this.go("idle", makeTrack(kit.weapon, this.cur, "guard"));
  }

  get weapon() { return WSTATS[this.kit.weapon]; }
  get weaponId() { return this.kit.weapon; }
  get hasShield() { return shieldMode(this.kit) === "arm"; }
  get alive() { return this.state !== "dead"; }
  get attacking() { return this.state === "windup" || this.state === "hold" || this.state === "release"; }
  /** Attack speed: weapon speed, plus a little from skill. */
  get speed() { return TEMPO * this.boost * this.weapon.speed * (0.92 + this.kit.skill * 0.16); }

  private go(s: State, tr?: Track) {
    this.state = s; this.t = 0;
    if (tr) { this.track = tr; this.trackT = 0; }
  }
  private tr(kind: Parameters<typeof makeTrack>[2], dir?: AttackDir | BlockDir) {
    return makeTrack(this.kit.weapon, this.cur, kind, dir, this.speed, this.weapon.mass);
  }

  effectiveDir(d: Dir): Dir { return d === DIR.THRUST && !this.weapon.thrust ? DIR.OVER : d; }

  attack(d: Dir): boolean {
    if (this.cd > 0) return false;
    if (!(this.state === "idle" || this.state === "block" || this.state === "recover" && this.trackT > this.track.impact + 0.12)) return false;
    this.dir = this.effectiveDir(d);
    this.attackSeq++;
    this.hitDone = false;
    this.boost = this.riposte > 0 ? 1.3 : 1;   // a riposte straight out of a good block comes faster
    this.riposte = 0;
    this.go("windup", this.tr("ready", ANIM_DIR[this.dir]));
    return true;
  }
  /** Cancel a wind-up into a block (Warband feint). */
  feint(d: Dir) { if (this.state === "windup" || this.state === "hold") this.blockNow(d); }
  release() { if (this.state === "hold" || this.state === "windup") this.startRelease(); }
  private startRelease() {
    this.hitDone = false; this.go("release", this.tr("release", ANIM_DIR[this.dir]));
    // the body goes with the blow: a short step into it, heavier weapons drag you further
    const f = this.dir === DIR.THRUST ? 1.25 : 0.9, m = 0.7 + this.weapon.mass * 0.35;
    this.kx += Math.sin(this.yaw) * f * m; this.kz += Math.cos(this.yaw) * f * m;
  }
  /** Take the force of a blow: knock-back along (dx,dz), torso snaps away from the side it came from. */
  impact(dx: number, dz: number, force: number, side: number, high: number) {
    this.kx += dx * force * 1.6; this.kz += dz * force * 1.6;
    this.reactV[0] -= force * (4 + high * 3);       // thrown back
    this.reactV[1] += side * force * 5;            // twisted away
    this.reactV[2] += side * force * 3;
  }
  block(d: Dir) {
    if (this.state === "idle" || this.state === "recover" && this.trackT > this.track.impact + 0.1) this.blockNow(d);
    else if (this.state === "block" && d !== this.dir) this.blockNow(d);
  }
  private blockNow(d: Dir) { this.dir = d; this.go("block", this.tr("block", BLOCK_DIR[d])); }
  unblock() { if (this.state === "block") this.go("idle", this.tr("guard")); }
  stagger() { if (this.alive) { this.boost = 1; this.go("stagger", this.tr("stagger")); this.cd = Math.max(this.cd, 0.25); } }
  /** Attack met a parry (weapon) or a shield / obstacle: bounce back like parried_/blocked_. */
  bounce(shield: boolean) {
    this.boost = 1;
    this.go("blockstun", this.tr(shield ? "blocked" : "parried", ANIM_DIR[this.dir]));
    // after the bounce you may block again, but not swing: the defender gets the riposte
    this.cd = Math.max(this.cd, shield ? 0.2 : 0.32);
  }
  /** Defender who stopped a blow: short window for a faster counter. */
  blocked() { this.riposte = 0.9; }
  die() { this.state = "dead"; this.t = 0; this.deadT = 0; }

  /** True on the frame the blow reaches its impact point. */
  get impactNow() { return this.state === "release" && !this.hitDone && this.trackT >= this.track.impact; }

  update(dt: number, holdAttack: boolean) {
    // body reaction spring (stiff, well damped: snaps out and comes back)
    for (let i = 0; i < 3; i++) {
      this.reactV[i] += (-this.react[i] * 140 - this.reactV[i] * 16) * dt;
      this.react[i] += this.reactV[i] * dt;
    }
    if (this.freeze > 0) { this.freeze -= dt; return; }
    this.t += dt; this.trackT += dt;
    const len = trackLength(this.track);
    switch (this.state) {
      case "windup": if (this.trackT >= len) { if (holdAttack) this.go("hold"); else this.startRelease(); } break;
      case "hold": if (!holdAttack || this.t > 3.5) this.startRelease(); break;
      case "release": if (this.hitDone && this.trackT > this.track.impact) this.state = "recover"; break;
      case "recover": case "stagger": case "blockstun": if (this.trackT >= len) this.go("idle"); break;
      case "dead": this.deadT += dt; break;
    }
    this.flash = Math.max(0, this.flash - dt * 4);
    // the lockout only counts down once the bounce animation is over
    if (this.state !== "blockstun" && this.state !== "stagger") this.cd = Math.max(0, this.cd - dt);
    this.riposte = Math.max(0, this.riposte - dt);
    if (this.state === "idle" || this.state === "block") this.boost = 1;
    // aim lean: full while swinging (Warband), a hint of it in guard
    const want = this.attacking ? this.aim : this.aim * 0.3;
    this.lean += (want - this.lean) * Math.min(1, dt * 7);
  }

  move(dt: number, ground: (x: number, z: number) => number) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const wl = Math.hypot(this.wish.x, this.wish.z);
    const fwd = wl > 0.01 ? (this.wish.x * fx + this.wish.z * fz) / wl : 1;
    // forward is fastest, sidestep slower, backpedal slowest; running only really helps forward
    const dirK = fwd >= 0 ? 0.74 + 0.26 * fwd : 0.74 - 0.16 * -fwd;
    const runK = this.wish.run ? 1 + 0.62 * Math.max(0, fwd) ** 1.5 + 0.08 : 1;
    let sp = 3.2 * dirK * runK * this.moveMul;
    if (this.state === "windup" || this.state === "hold") sp *= 0.7;
    if (this.state === "block") sp *= 0.62;
    if (this.state === "release" || this.state === "stagger" || this.state === "blockstun") sp *= 0.4;
    if (!this.alive) sp = 0;
    const k = clamp(dt * (fwd < 0 ? 7 : 9), 0, 1);
    this.vx = lerp(this.vx, this.wish.x * sp, k); this.vz = lerp(this.vz, this.wish.z * sp, k);
    const kd = Math.exp(-dt * 7);
    this.kx *= kd; this.kz *= kd;
    const fr = this.freeze > 0 ? 0.15 : 1;
    this.x += (this.vx + this.kx) * dt * fr; this.z += (this.vz + this.kz) * dt * fr;
    this.y = ground(this.x, this.z);
    const speed = Math.hypot(this.vx, this.vz);
    this.walkT += dt * Math.min(1.7, speed / 2.1);
  }

  faceTo(yaw: number, dt: number, rate = 8) {
    const d = wrapAngle(yaw - this.yaw);
    this.yaw = wrapAngle(this.yaw + clamp(d, -rate * dt, rate * dt));
  }

  draw(items: { mesh: GMesh; model: Mat4 }[]) {
    const s = sampleTrack(this.track, this.trackT), lead = sampleTrack(this.track, this.trackT + 0.07);
    this.cur = s.k;
    const label = this.state === "hold" ? "trzymanie" : this.state === "idle" ? "garda" : s.label;
    const block = this.state === "block" ? s.block : null;
    let root = trs(m4(), this.x, this.y, this.z, this.yaw);
    let kind: "combat" | "walkcombat" | "idle" = Math.hypot(this.vx, this.vz) > 0.4 ? "walkcombat" : "combat";
    if (!this.alive) {
      kind = "idle";
      const f = clamp(this.deadT / 0.75, 0, 1), e = f * f;
      root = mul(m4(), root, trs(m4(), 0, -e * 0.08, -e * 0.25, 0, -e * 1.5, e * 0.25));
    }
    const sh = shieldMode(this.kit);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), sp = Math.hypot(this.vx, this.vz);
    const loco = { fwd: (this.vx * fx + this.vz * fz) / (sp || 1), side: (this.vx * fz - this.vz * fx) / (sp || 1), speed: sp };
    const F = frame(root, kind, kind === "walkcombat" ? this.walkT : this.t + this.id, {
      weapon: this.kit.weapon, shield: sh, loco, aim: this.alive ? this.lean : 0, react: this.react,
      drive: this.alive ? { key: s.k, lead: lead.k, block, label } : undefined,
    });
    this.lastJ = F.J;
    for (const p of this.mesh.parts) {
      if (this.hideHead && p.joint === "head") continue;
      if (this.severed.has(p.joint)) continue;
      items.push({ mesh: p.mesh, model: F.J[p.joint] });
    }
    this.weaponMat = F.weapon; this.shieldMat = F.shield;
    if (F.weapon && !this.severed.has("handR")) items.push({ mesh: this.mesh.weapon, model: F.weapon });
    if (F.shield && this.mesh.shield && !(sh === "arm" && this.severed.has("farmL"))) items.push({ mesh: this.mesh.shield, model: F.shield });
  }

  /** World position of the weapon tip (for sparks). */
  tip(): [number, number, number] {
    const w = this.weaponMat; if (!w) return [this.x, this.y + 1.3, this.z];
    const L = WEAPONS[this.kit.weapon].tip;
    return [w[12] + w[8] * L, w[13] + w[9] * L, w[14] + w[10] * L];
  }
  get chest(): [number, number, number] { return [this.x, this.y + 1.4, this.z]; }
  get eye(): [number, number, number] { return [this.x + Math.sin(this.yaw) * 0.14, this.y + 1.66, this.z + Math.cos(this.yaw) * 0.14]; }
}
