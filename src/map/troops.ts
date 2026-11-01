// Troop types: what a soldier is on the campaign map (wage, strength) and in
// battle (the Kit the fighter is built from).
import { ARMOURS } from "../game/combat.ts";
import type { Kit } from "../game/warrior.ts";

export type TroopId = "chlop" | "pacholek" | "zbrojny" | "halabardnik" | "plytowy" | "rycerz" | "rozbojnik" | "herszt" | "dezerter" | "kupiec" | "zywy_trup";
export interface TroopType {
  id: TroopId; name: { pl: string; en: string };
  kit: Omit<Kit, "name">; wage: number; tier: number; upTo?: TroopId; upCost?: number;
  undead?: boolean;
}
const k = (loadout: Kit["loadout"], weapon: Kit["weapon"], shield: boolean, armour: keyof typeof ARMOURS, hp: number, skill: number): Omit<Kit, "name"> => ({ loadout, weapon, shield, armour: ARMOURS[armour], hp, skill });

export const TROOPS: Record<TroopId, TroopType> = {
  chlop: { id: "chlop", name: { pl: "Chłop z siekierą", en: "Peasant with an axe" }, kit: k("base", "hatchet", false, "rags", 75, 0.25), wage: 1, tier: 0, upTo: "pacholek", upCost: 30 },
  pacholek: { id: "pacholek", name: { pl: "Pachołek z włócznią", en: "Spear levy" }, kit: k("levy", "spear", false, "gambeson", 85, 0.4), wage: 3, tier: 1, upTo: "zbrojny", upCost: 90 },
  zbrojny: { id: "zbrojny", name: { pl: "Zbrojny", en: "Sergeant" }, kit: k("sergeant", "sword", true, "mail", 100, 0.55), wage: 8, tier: 2, upTo: "plytowy", upCost: 220 },
  halabardnik: { id: "halabardnik", name: { pl: "Halabardnik", en: "Glaiveman" }, kit: k("levy", "glaive", false, "gambeson", 95, 0.55), wage: 6, tier: 2 },
  plytowy: { id: "plytowy", name: { pl: "Zbrojny w płytach", en: "Plated man-at-arms" }, kit: k("plate", "mace", false, "plate", 110, 0.68), wage: 14, tier: 3 },
  rycerz: { id: "rycerz", name: { pl: "Rycerz", en: "Knight" }, kit: k("knight", "longsword", false, "plate", 125, 0.78), wage: 25, tier: 4 },
  rozbojnik: { id: "rozbojnik", name: { pl: "Rozbójnik", en: "Brigand" }, kit: k("base", "hatchet", false, "rags", 80, 0.3), wage: 2, tier: 0 },
  herszt: { id: "herszt", name: { pl: "Herszt zbójców", en: "Brigand chief" }, kit: k("sergeant", "kord", true, "gambeson", 110, 0.55), wage: 10, tier: 2 },
  dezerter: { id: "dezerter", name: { pl: "Dezerter", en: "Deserter" }, kit: k("levy", "spear", false, "gambeson", 90, 0.45), wage: 4, tier: 1 },
  kupiec: { id: "kupiec", name: { pl: "Najemny strażnik", en: "Caravan guard" }, kit: k("sergeant", "sword", true, "mail", 100, 0.5), wage: 8, tier: 2 },
  // placeholder look until undead models arrive (build 7): rags and axes, but they do not eat, flee or bleed out
  zywy_trup: { id: "zywy_trup", name: { pl: "Żywy trup", en: "Risen corpse" }, kit: k("base", "hatchet", false, "rags", 70, 0.2), wage: 0, tier: 0, undead: true },
};

export function kitOf(t: TroopId): Kit { const T = TROOPS[t]; return { ...T.kit, name: T.name }; }
/** Rough fighting worth of one soldier (for auto-resolve and AI decisions). */
export function power(t: TroopId): number {
  const T = TROOPS[t], a = T.kit.armour;
  return (T.kit.hp / 100) * (1 + (a.body + a.head) / 90) * (0.55 + T.kit.skill);
}
