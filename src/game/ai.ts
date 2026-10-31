// Melee AI: circle at weapon range, take turns attacking (tokens), read the
// player's windup and pick a block after a reaction delay that depends on skill.
import { wrapAngle, clamp } from "../core/math.ts";
import { Warrior as Fighter } from "./warrior.ts";
import { DIR, Dir, mirror } from "./combat.ts";

export class Brain {
  cooldown = 1 + Math.random();
  strafe = Math.random() < 0.5 ? -1 : 1;
  strafeT = 0;
  react = -1;              // countdown until we respond to a seen windup
  seenSeq = -1;
  plannedBlock: Dir = DIR.OVER;
  holdFor = 0;

  constructor(public me: Fighter) {}

  update(dt: number, target: Fighter, all: Fighter[], tokens: { used: number; max: number }) {
    const me = this.me;
    if (!me.alive) { me.wish.x = me.wish.z = 0; return; }
    const dx = target.x - me.x, dz = target.z - me.z, dist = Math.hypot(dx, dz) || 0.001;
    const nx = dx / dist, nz = dz / dist;
    const yawTo = Math.atan2(dx, dz);
    const skill = me.kit.skill;
    me.faceTo(yawTo, dt, me.attacking ? 2.4 : 6);

    if (!target.alive) { me.wish.x = me.wish.z = 0; if (me.state === "block") me.unblock(); return; }

    const range = me.weapon.reach + 0.55;
    // --- movement: approach, keep range, strafe ---
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = Math.random() < 0.5 ? -1 : 1; this.strafeT = 1.2 + Math.random() * 2; }
    let mx = 0, mz = 0;
    const want = me.aiToken ? range * 0.85 : range + 1.4;
    if (dist > want + 0.4) { mx += nx; mz += nz; }
    else if (dist < want - 0.5) { mx -= nx * 0.8; mz -= nz * 0.8; }
    const sw = me.aiToken ? 0.25 : 0.7;
    mx += -nz * this.strafe * sw; mz += nx * this.strafe * sw;
    // separation from allies
    for (const o of all) {
      if (o === me || !o.alive || o.team !== me.team) continue;
      const ox = me.x - o.x, oz = me.z - o.z, od = Math.hypot(ox, oz);
      if (od < 2.2 && od > 0.01) { mx += (ox / od) * (2.2 - od) * 0.9; mz += (oz / od) * (2.2 - od) * 0.9; }
    }
    const ml = Math.hypot(mx, mz);
    me.wish.x = ml > 0.01 ? mx / Math.max(1, ml) : 0;
    me.wish.z = ml > 0.01 ? mz / Math.max(1, ml) : 0;
    me.wish.run = dist > 9;

    // --- defence: read the target's windup ---
    const threatened = target.attacking && dist < target.weapon.reach + 1.6 && this.facingMe(target);
    if (threatened && this.seenSeq !== target.attackSeq && this.react < 0 && (target.state === "windup" || target.state === "hold")) {
      this.react = lerp(0.42, 0.16, skill) + Math.random() * 0.12;
      this.seenSeq = target.attackSeq;
      const correct = Math.random() < lerp(0.35, 0.82, skill);
      const right = mirror(target.dir);
      this.plannedBlock = correct ? right : ([0, 1, 2, 3] as Dir[]).filter((d) => d !== right)[Math.floor(Math.random() * 3)];
    }
    if (this.react >= 0) {
      this.react -= dt;
      if (this.react < 0) {
        if (me.state === "windup" && Math.random() < skill * 0.6) me.feint(this.plannedBlock);
        else me.block(this.plannedBlock);
        this.holdFor = 0.5 + Math.random() * 0.4;
      }
    }
    if (me.state === "block") {
      this.holdFor -= dt;
      if (this.holdFor <= 0 && !target.attacking) me.unblock();
    }

    // --- offence ---
    this.cooldown -= dt;
    if (!me.aiToken && tokens.used < tokens.max && this.cooldown < 0.5) { me.aiToken = true; tokens.used++; }
    if (me.aiToken && this.cooldown <= 0 && dist < range + 0.3 && (me.state === "idle" || (me.state === "block" && !target.attacking))) {
      if (me.state === "block") me.unblock();
      // prefer the side the player is not covering
      let d: Dir = ([0, 1, 2, 3] as Dir[])[Math.floor(Math.random() * 4)];
      if (target.state === "block" && Math.random() < skill) {
        const covered = target.dir;
        const options = ([0, 1, 2, 3] as Dir[]).filter((x) => mirror(x) !== covered);
        d = options[Math.floor(Math.random() * options.length)];
      }
      if (me.attack(d)) {
        me.aiHold = Math.random() < 0.45 ? 0.15 + Math.random() * 0.7 * skill : 0;
        this.cooldown = lerp(2.6, 1.1, skill) + Math.random() * 1.2;
        me.aiToken = false; tokens.used = Math.max(0, tokens.used - 1);
      }
    }
  }

  private facingMe(t: Fighter) {
    const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw);
    const dx = this.me.x - t.x, dz = this.me.z - t.z, d = Math.hypot(dx, dz) || 1;
    return (fx * dx + fz * dz) / d > 0.5;
  }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * clamp(t, 0, 1); }
export const _wrap = wrapAngle;
