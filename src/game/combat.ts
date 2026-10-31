// Pure combat rules: directions, weapons, armour, damage. No rendering here,
// so it is unit-tested in tests/combat.test.ts.

/** Attack/block directions, named from the attacker's point of view. */
export const DIR = { OVER: 0, RIGHT: 1, LEFT: 2, THRUST: 3 } as const;
export type Dir = 0 | 1 | 2 | 3;

export type DmgType = "cut" | "pierce" | "blunt";
export type BodyPart = "head" | "body" | "legs";

export interface Weapon {
  id: string;
  name: { pl: string; en: string };
  twoHanded: boolean;
  shield: boolean;
  reach: number;          // metres from shoulder
  speed: number;          // 1 = baseline sword
  swing: { dmg: number; type: DmgType } | null;
  thrust: { dmg: number; type: DmgType } | null;
  /** Visual: blade/head length and kind */
  look: "sword" | "axe" | "greataxe" | "mace" | "spear";
}

export interface Armour { head: number; body: number; legs: number; name: { pl: string; en: string } }

export const WEAPONS: Record<string, Weapon> = {
  sword: { id: "sword", name: { pl: "Miecz zbrojny", en: "Arming sword" }, twoHanded: false, shield: true, reach: 1.05, speed: 1.0,
    swing: { dmg: 31, type: "cut" }, thrust: { dmg: 25, type: "pierce" }, look: "sword" },
  greataxe: { id: "greataxe", name: { pl: "Topór katowski", en: "Headsman's axe" }, twoHanded: true, shield: false, reach: 1.15, speed: 0.78,
    swing: { dmg: 46, type: "cut" }, thrust: null, look: "greataxe" },
  mace: { id: "mace", name: { pl: "Buzdygan", en: "Flanged mace" }, twoHanded: false, shield: true, reach: 0.9, speed: 1.05,
    swing: { dmg: 27, type: "blunt" }, thrust: null, look: "mace" },
  spear: { id: "spear", name: { pl: "Włócznia", en: "War spear" }, twoHanded: true, shield: false, reach: 1.9, speed: 0.95,
    swing: { dmg: 16, type: "blunt" }, thrust: { dmg: 36, type: "pierce" }, look: "spear" },
  hatchet: { id: "hatchet", name: { pl: "Siekiera", en: "Hatchet" }, twoHanded: false, shield: false, reach: 0.85, speed: 1.08,
    swing: { dmg: 29, type: "cut" }, thrust: null, look: "axe" },
};

export const ARMOURS: Record<string, Armour> = {
  rags: { head: 0, body: 6, legs: 3, name: { pl: "Łachmany", en: "Rags" } },
  gambeson: { head: 8, body: 20, legs: 10, name: { pl: "Przeszywanica", en: "Gambeson" } },
  mail: { head: 30, body: 34, legs: 22, name: { pl: "Kolczuga", en: "Mail hauberk" } },
  plate: { head: 48, body: 52, legs: 40, name: { pl: "Płyty", en: "Plate harness" } },
};

/** How strongly each damage type is soaked by armour. Cut is stopped by
 *  metal, blunt goes through it, pierce sits between. */
export const SOAK: Record<DmgType, number> = { cut: 2.2, pierce: 1.25, blunt: 0.55 };
export const PART_MULT: Record<BodyPart, number> = { head: 1.4, body: 1.0, legs: 0.85 };

/** Swings come from one side; thrusts and overheads stay put. */
export function mirror(d: Dir): Dir {
  return d === DIR.LEFT ? DIR.RIGHT : d === DIR.RIGHT ? DIR.LEFT : d;
}

/** Defender blocks the side the blow arrives on; that is the mirrored attacker direction. */
export function blockMatches(attack: Dir, block: Dir): boolean {
  return mirror(attack) === block;
}

/** Weapons without a thrust turn a thrust into an overhead (like M&B axes). */
export function effectiveDir(w: Weapon, d: Dir): Dir {
  if (d === DIR.THRUST && !w.thrust) return DIR.OVER;
  if (d !== DIR.THRUST && !w.swing) return DIR.THRUST;
  return d;
}

export function attackOf(w: Weapon, d: Dir) {
  const ed = effectiveDir(w, d);
  const a = ed === DIR.THRUST ? w.thrust! : w.swing!;
  // overheads hit a little harder, thrusts a little faster
  const mult = ed === DIR.OVER ? 1.08 : 1.0;
  return { dir: ed, dmg: a.dmg * mult, type: a.type };
}

/** Speed bonus from closing velocity along the attack line (m/s), M&B-style. */
export function speedBonus(closing: number): number {
  return Math.max(-0.2, Math.min(0.5, closing * 0.07));
}

export function damage(raw: number, type: DmgType, armour: number, part: BodyPart, closing = 0): number {
  const r = raw * (1 + speedBonus(closing)) * PART_MULT[part];
  const d = r * 100 / (100 + armour * SOAK[type]);
  return Math.max(1, Math.round(d));
}

/** Where a blow lands. roll in [0,1). */
export function hitPart(dir: Dir, roll: number): BodyPart {
  if (dir === DIR.OVER) return roll < 0.55 ? "head" : "body";
  if (dir === DIR.THRUST) return roll < 0.15 ? "head" : roll < 0.85 ? "body" : "legs";
  return roll < 0.12 ? "head" : roll < 0.8 ? "body" : "legs";
}

/** Phase timings in seconds for a weapon. */
export function timings(w: Weapon) {
  const k = 1 / w.speed;
  return { windup: 0.38 * k, release: 0.2 * k, recover: 0.32 * k, stagger: 0.45, blockStun: 0.28 };
}

/** Shield covers every direction if the blow comes from the front. */
export function shieldCovers(facingDot: number): boolean {
  return facingDot > Math.cos((105 * Math.PI) / 180);
}

/** Map a mouse movement vector (screen space, +y down) to a direction. */
export function dirFromMouse(dx: number, dy: number): Dir {
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? DIR.LEFT : DIR.RIGHT;
  return dy < 0 ? DIR.OVER : DIR.THRUST;
}
