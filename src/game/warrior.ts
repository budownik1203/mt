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
export interface WStats { reach: number; speed: number; swing: { dmg: number; type: DmgType } | null; thrust: { dmg: number; type: DmgType } | null }
export const WSTATS: Record<WeaponId, WStats> = {
  sword: { reach: 1.05, speed: 1.0, swing: { dmg: 31, type: "cut" }, thrust: { dmg: 25, type: "pierce" } },
  kord: { reach: 0.85, speed: 1.08, swing: { dmg: 29, type: "cut" }, thrust: { dmg: 23, type: "pierce" } },
  hatchet: { reach: 0.8, speed: 1.06, swing: { dmg: 30, type: "cut" }, thrust: null },
  mace: { reach: 0.85, speed: 1.02, swing: { dmg: 28, type: "blunt" }, thrust: null },
  longsword: { reach: 1.3, speed: 0.9, swing: { dmg: 38, type: "cut" }, thrust: { dmg: 30, type: "pierce" } },
  greataxe: { reach: 1.1, speed: 0.8, swing: { dmg: 46, type: "cut" }, thrust: null },
  spear: { reach: 1.85, speed: 0.95, swing: { dmg: 16, type: "blunt" }, thrust: { dmg: 36, type: "pierce" } },
  glaive: { reach: 1.95, speed: 0.88, swing: { dmg: 36, type: "cut" }, thrust: { dmg: 28, type: "pierce" } },
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
  get speed() { return TEMPO * this.weapon.speed * (0.92 + this.kit.skill * 0.16); }

  private go(s: State, tr?: Track) {
    this.state = s; this.t = 0;
    if (tr) { this.track = tr; this.trackT = 0; }
  }
  private tr(kind: Parameters<typeof makeTrack>[2], dir?: AttackDir | BlockDir) {
    return makeTrack(this.kit.weapon, this.cur, kind, dir, this.speed);
  }

  effectiveDir(d: Dir): Dir { return d === DIR.THRUST && !this.weapon.thrust ? DIR.OVER : d; }

  attack(d: Dir): boolean {
    if (!(this.state === "idle" || this.state === "block" || this.state === "recover" && this.trackT > this.track.impact + 0.12)) return false;
    this.dir = this.effectiveDir(d);
    this.attackSeq++;
    this.hitDone = false;
    this.go("windup", this.tr("ready", ANIM_DIR[this.dir]));
    return true;
  }
  /** Cancel a wind-up into a block (Warband feint). */
  feint(d: Dir) { if (this.state === "windup" || this.state === "hold") this.blockNow(d); }
  release() { if (this.state === "hold" || this.state === "windup") this.startRelease(); }
  private startRelease() { this.hitDone = false; this.go("release", this.tr("release", ANIM_DIR[this.dir])); }
  block(d: Dir) {
    if (this.state === "idle" || this.state === "recover" && this.trackT > this.track.impact + 0.1) this.blockNow(d);
    else if (this.state === "block" && d !== this.dir) this.blockNow(d);
  }
  private blockNow(d: Dir) { this.dir = d; this.go("block", this.tr("block", BLOCK_DIR[d])); }
  unblock() { if (this.state === "block") this.go("idle", this.tr("guard")); }
  stagger() { if (this.alive) this.go("stagger", this.tr("stagger")); }
  /** Attack met a parry (weapon) or a shield / obstacle: bounce back like parried_/blocked_. */
  bounce(shield: boolean) { this.go("blockstun", this.tr(shield ? "blocked" : "parried", ANIM_DIR[this.dir])); }
  die() { this.state = "dead"; this.t = 0; this.deadT = 0; }

  /** True on the frame the blow reaches its impact point. */
  get impactNow() { return this.state === "release" && !this.hitDone && this.trackT >= this.track.impact; }

  update(dt: number, holdAttack: boolean) {
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
  }

  move(dt: number, ground: (x: number, z: number) => number) {
    let sp = this.wish.run ? 5.2 : 3.2;
    if (this.state === "windup" || this.state === "hold") sp *= 0.7;
    if (this.state === "block") sp *= 0.62;
    if (this.state === "release" || this.state === "stagger" || this.state === "blockstun") sp *= 0.4;
    if (!this.alive) sp = 0;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const fwd = this.wish.x * fx + this.wish.z * fz;
    if (fwd < -0.3) sp *= 0.68;
    const k = clamp(dt * 9, 0, 1);
    this.vx = lerp(this.vx, this.wish.x * sp, k); this.vz = lerp(this.vz, this.wish.z * sp, k);
    this.x += this.vx * dt; this.z += this.vz * dt;
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
      weapon: this.kit.weapon, shield: sh, loco,
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
